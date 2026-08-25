import type { SQLiteDatabase } from "expo-sqlite";

import { replaceTopoData } from "../db/schema";
import { datePrefix, latestTopoVersion } from "../domain/topoVersion";
import type { TopoAreaSeed, TopoBoulderSeed, TopoSeed } from "../domain/types";
import { assertAllowedUrl } from "./allowlist";

/** Public OpenTopo web repo — source of truth for area content updates. */
const REPO = "mlioo/opentopo";
const AREAS_PREFIX = "content/areas/";

const endpoints = {
  areasCommitUrl: `https://api.github.com/repos/${REPO}/commits?path=content/areas&per_page=1`,
  treeUrl: (sha: string) =>
    `https://api.github.com/repos/${REPO}/git/trees/${encodeURIComponent(sha)}?recursive=1`,
  rawUrl: (sha: string, path: string) =>
    `https://raw.githubusercontent.com/${REPO}/${encodeURIComponent(sha)}/${path}`
};

async function openTopoFetch(rawUrl: string): Promise<Response> {
  const url = assertAllowedUrl(rawUrl);
  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "OpenTopo-Companion"
    }
  });
  if (!response.ok) throw new Error(`OpenTopo update check failed (${response.status}).`);
  return response;
}

async function openTopoJson<T>(rawUrl: string): Promise<T> {
  const response = await openTopoFetch(rawUrl);
  return (await response.json()) as T;
}

function validateAreas(value: unknown): TopoAreaSeed[] {
  if (!Array.isArray(value)) throw new Error("OpenTopo returned an invalid area bundle.");
  for (const area of value) {
    if (!area || typeof area !== "object" || typeof (area as { id?: unknown }).id !== "string") {
      throw new Error("OpenTopo area bundle contains an invalid record.");
    }
  }
  return value as TopoAreaSeed[];
}

type GithubCommit = {
  sha?: string;
  commit?: {
    author?: { date?: string };
    committer?: { date?: string };
  };
};

function commitDate(commit: GithubCommit | undefined): string | undefined {
  return (
    datePrefix(commit?.commit?.committer?.date ?? "") ??
    datePrefix(commit?.commit?.author?.date ?? "") ??
    undefined
  );
}

/** Build a mobile topo seed from public OpenTopo `content/areas` at a given commit. */
async function fetchTopoSeedFromOpenTopo(commitSha: string, remoteDate?: string): Promise<TopoSeed> {
  const tree = await openTopoJson<{
    truncated?: boolean;
    tree?: Array<{ path?: string; type?: string }>;
  }>(endpoints.treeUrl(commitSha));

  if (tree.truncated) {
    throw new Error("OpenTopo content tree was truncated; try again later.");
  }

  const areaPaths = (tree.tree ?? [])
    .filter(
      (entry) =>
        entry.type === "blob" &&
        typeof entry.path === "string" &&
        entry.path.startsWith(AREAS_PREFIX) &&
        entry.path.endsWith("/area.json")
    )
    .map((entry) => entry.path as string)
    .sort();

  if (!areaPaths.length) {
    throw new Error("OpenTopo did not return any area definitions.");
  }

  const areas: TopoAreaSeed[] = [];
  for (const areaPath of areaPaths) {
    const areaDir = areaPath.slice(0, -"/area.json".length);
    const area = await openTopoJson<Record<string, unknown>>(endpoints.rawUrl(commitSha, areaPath));
    const rawBoulders = area.boulders;
    const boulderRefs = Array.isArray(rawBoulders)
      ? rawBoulders.filter((ref): ref is string => typeof ref === "string" && ref.trim().length > 0)
      : [];
    const boulders: TopoBoulderSeed[] = [];
    for (const ref of boulderRefs) {
      const boulderPath = `${areaDir}/${ref.replace(/^\/+/, "")}`;
      boulders.push(await openTopoJson<TopoBoulderSeed>(endpoints.rawUrl(commitSha, boulderPath)));
    }
    areas.push({ ...area, boulders } as TopoAreaSeed);
  }

  const validAreas = validateAreas(areas);
  return {
    schemaVersion: 1,
    version: latestTopoVersion(
      [...validAreas.map((area) => area.updated), remoteDate],
      new Date().toISOString()
    ),
    areas: validAreas
  };
}

export interface UpdateCheck {
  available: boolean;
  currentVersion: string;
  remoteVersion: string;
  remoteDate?: string;
  message: string;
}

export async function checkForTopoUpdate(db: SQLiteDatabase): Promise<UpdateCheck> {
  const current = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM metadata WHERE key = 'topo_remote_commit'"
  );
  const commits = await openTopoJson<GithubCommit[]>(endpoints.areasCommitUrl);
  const remote = commits[0];
  const remoteVersion = remote?.sha ?? "";
  if (!remoteVersion) throw new Error("GitHub did not return an OpenTopo content revision.");
  const currentVersion = current?.value ?? "bundled";
  const available = currentVersion !== remoteVersion;
  return {
    available,
    currentVersion,
    remoteVersion,
    remoteDate: commitDate(remote),
    message: available ? "A newer topo bundle is ready." : "Your offline topo is current."
  };
}

export async function downloadTopoUpdate(
  db: SQLiteDatabase,
  remoteVersion: string,
  remoteDate?: string
): Promise<void> {
  const seed = await fetchTopoSeedFromOpenTopo(remoteVersion, remoteDate);
  await replaceTopoData(db, seed);
  await db.runAsync(
    `INSERT INTO metadata (key, value) VALUES ('topo_remote_commit', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    remoteVersion
  );
  await db.runAsync(
    `INSERT INTO metadata (key, value) VALUES ('topo_last_checked_at', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    new Date().toISOString()
  );
}
