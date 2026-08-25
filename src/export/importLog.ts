import { File } from "expo-file-system";
import type { SQLiteDatabase } from "expo-sqlite";

import type {
  AttemptResult,
  ImportAttemptRow,
  ImportLogPayload,
  ImportProblemNoteRow,
  ImportSessionRow,
  PerceivedDifficulty
} from "../domain/types";

const ATTEMPT_RESULTS = new Set<AttemptResult>(["attempt", "send", "flash"]);

type TopoArea = { id: string; nameEn: string; nameJa: string };
type TopoBoulder = { id: string; areaId: string; nameEn: string; nameJa: string };
type TopoProblem = {
  id: string;
  areaId: string;
  boulderId: string;
  nameEn: string;
  nameJa: string;
  grade: string;
};

let idCounter = 0;

function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function asString(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function asNullableString(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

function asNullableInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function asTryCount(value: unknown): number {
  const n = asNullableInt(value);
  return n !== null && n >= 1 ? n : 1;
}

function asPerceivedDifficulty(value: unknown): PerceivedDifficulty {
  const n = asNullableInt(value) ?? 0;
  if (n <= -2) return -2;
  if (n === -1) return -1;
  if (n === 1) return 1;
  if (n >= 2) return 2;
  return 0;
}

function asAttemptResult(value: unknown): AttemptResult | null {
  const text = asString(value).trim().toLowerCase();
  return ATTEMPT_RESULTS.has(text as AttemptResult) ? (text as AttemptResult) : null;
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      cell = "";
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
    } else if (ch === "\r") {
      // ignore CR; handle CRLF via \n
    } else {
      cell += ch;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some((value) => value.length > 0)) rows.push(row);
  }

  return rows;
}

function localDayKey(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeSession(row: Record<string, unknown>): ImportSessionRow | null {
  const id = asString(row.id).trim();
  const areaId = asString(row.area_id).trim();
  const startedAt = asString(row.started_at).trim();
  if (!id || !areaId || !startedAt) return null;

  const createdAt = asString(row.created_at, startedAt);
  const updatedAt = asString(row.updated_at, createdAt);

  return {
    id,
    area_id: areaId,
    custom_area_name: asString(row.custom_area_name),
    started_at: startedAt,
    ended_at: asNullableString(row.ended_at),
    energy: asNullableInt(row.energy),
    weather: asNullableInt(row.weather),
    mental: asNullableInt(row.mental),
    mood: asNullableInt(row.mood),
    skin: asNullableInt(row.skin),
    conditions: asString(row.conditions),
    reflection: asString(row.reflection),
    notes: asString(row.notes),
    created_at: createdAt,
    updated_at: updatedAt
  };
}

function normalizeAttempt(row: Record<string, unknown>): ImportAttemptRow | null {
  const id = asString(row.id).trim();
  const sessionId = asString(row.session_id).trim();
  const areaId = asString(row.area_id).trim();
  const boulderId = asString(row.boulder_id).trim() || "manual";
  const problemId = asString(row.problem_id).trim();
  const occurredAt = asString(row.occurred_at).trim();
  const result = asAttemptResult(row.result);
  const problemName = asString(row.problem_name);
  if (!id || !sessionId || !areaId || !occurredAt || !result) return null;
  if (!problemId && !problemName.trim()) return null;

  const createdAt = asString(row.created_at, occurredAt);
  const updatedAt = asString(row.updated_at, createdAt);

  return {
    id,
    session_id: sessionId,
    area_id: areaId,
    boulder_id: boulderId,
    problem_id: problemId || `manual_${id}`,
    problem_name: problemName,
    boulder_name: asString(row.boulder_name),
    grade: asString(row.grade),
    occurred_at: occurredAt,
    result,
    try_count: asTryCount(row.try_count),
    perceived_difficulty: asPerceivedDifficulty(row.perceived_difficulty),
    notes: asString(row.notes),
    created_at: createdAt,
    updated_at: updatedAt
  };
}

function normalizeNote(row: Record<string, unknown>): ImportProblemNoteRow | null {
  const id = asString(row.id).trim();
  const areaId = asString(row.area_id).trim();
  const problemId = asString(row.problem_id).trim();
  const body = asString(row.body);
  if (!id || !areaId || !problemId || !body.trim()) return null;

  const createdAt = asString(row.created_at, new Date().toISOString());
  const updatedAt = asString(row.updated_at, createdAt);

  return {
    id,
    area_id: areaId,
    problem_id: problemId,
    body,
    created_at: createdAt,
    updated_at: updatedAt
  };
}

export function parseJsonImport(text: string): ImportLogPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("This file is not valid JSON.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("This file is not a Tick Mark log backup.");
  }

  const bundle = parsed as Record<string, unknown>;
  if (bundle.format !== "opentopo-log") {
    throw new Error('Expected format "opentopo-log".');
  }

  const schemaVersion = asNullableInt(bundle.schemaVersion);
  if (schemaVersion === null || schemaVersion < 1 || schemaVersion > 3) {
    throw new Error(`Unsupported schema version: ${String(bundle.schemaVersion)}.`);
  }

  const sessions = (Array.isArray(bundle.sessions) ? bundle.sessions : [])
    .map((row) => (row && typeof row === "object" ? normalizeSession(row as Record<string, unknown>) : null))
    .filter((row): row is ImportSessionRow => row !== null);

  const sessionIds = new Set(sessions.map((session) => session.id));
  let skipped = 0;

  const attempts = (Array.isArray(bundle.attempts) ? bundle.attempts : [])
    .map((row) => {
      if (!row || typeof row !== "object") {
        skipped += 1;
        return null;
      }
      const attempt = normalizeAttempt(row as Record<string, unknown>);
      if (!attempt || !sessionIds.has(attempt.session_id)) {
        skipped += 1;
        return null;
      }
      return attempt;
    })
    .filter((row): row is ImportAttemptRow => row !== null);

  const problemNotes = (Array.isArray(bundle.problemNotes) ? bundle.problemNotes : [])
    .map((row) => {
      if (!row || typeof row !== "object") {
        skipped += 1;
        return null;
      }
      const note = normalizeNote(row as Record<string, unknown>);
      if (!note) {
        skipped += 1;
        return null;
      }
      return note;
    })
    .filter((row): row is ImportProblemNoteRow => row !== null);

  if (sessions.length === 0 && attempts.length === 0 && problemNotes.length === 0) {
    throw new Error("This backup has no importable sessions, attempts, or notes.");
  }

  return {
    source: "json",
    sessions,
    attempts,
    problemNotes,
    skipped
  };
}

async function loadTopoLookups(db: SQLiteDatabase): Promise<{
  areas: TopoArea[];
  boulders: TopoBoulder[];
  problems: TopoProblem[];
}> {
  const [areas, boulders, problems] = await Promise.all([
    db.getAllAsync<TopoArea>("SELECT id, name_en AS nameEn, name_ja AS nameJa FROM topo_areas"),
    db.getAllAsync<TopoBoulder>(
      "SELECT id, area_id AS areaId, name_en AS nameEn, name_ja AS nameJa FROM topo_boulders"
    ),
    db.getAllAsync<TopoProblem>(
      `SELECT id, area_id AS areaId, boulder_id AS boulderId, name_en AS nameEn, name_ja AS nameJa, grade
       FROM topo_problems`
    )
  ]);
  return { areas, boulders, problems };
}

function findByName<T extends { nameEn: string; nameJa: string }>(items: T[], name: string): T | null {
  const key = normalizeKey(name);
  if (!key) return null;
  const match = items.find(
    (item) => normalizeKey(item.nameEn) === key || normalizeKey(item.nameJa) === key
  );
  return match ?? null;
}

export async function parseCsvImport(db: SQLiteDatabase, text: string): Promise<ImportLogPayload> {
  const rows = parseCsv(text.replace(/^\uFEFF/, ""));
  if (rows.length < 2) {
    throw new Error("This spreadsheet has no attempt rows.");
  }

  const headerRow = rows[0];
  if (!headerRow) {
    throw new Error("This spreadsheet has no attempt rows.");
  }
  const headers = headerRow.map((header) => normalizeKey(header));
  const indexOf = (name: string) => headers.indexOf(name);
  const required = ["date", "result", "area", "problem"];
  for (const name of required) {
    if (indexOf(name) < 0) {
      throw new Error(`Missing required column: ${name}.`);
    }
  }

  const { areas, boulders, problems } = await loadTopoLookups(db);

  type ResolvedRow = {
    occurredAt: string;
    areaId: string;
    customAreaName: string;
    boulderId: string;
    problemId: string;
    problemName: string;
    boulderName: string;
    grade: string;
    result: AttemptResult;
    tryCount: number;
    perceivedDifficulty: PerceivedDifficulty;
    notes: string;
    sessionReflection: string;
  };

  const resolved: ResolvedRow[] = [];
  let skipped = 0;
  const customAreaIds = new Map<string, string>();

  for (const cells of rows.slice(1)) {
    const get = (name: string) => {
      const index = indexOf(name);
      return index >= 0 ? asString(cells[index]).trim() : "";
    };

    const occurredAt = get("date");
    const result = asAttemptResult(get("result"));
    const areaName = get("area");
    const boulderName = get("boulder");
    const problemName = get("problem");
    const problemJa = get("problem_ja");
    const grade = get("grade");
    const displayProblem = problemName || problemJa;

    if (!occurredAt || !result || !areaName || !displayProblem) {
      skipped += 1;
      continue;
    }
    if (!localDayKey(occurredAt)) {
      skipped += 1;
      continue;
    }

    const area = findByName(areas, areaName);
    let boulder = area
      ? findByName(
          boulders.filter((item) => item.areaId === area.id),
          boulderName
        )
      : null;

    let problem: TopoProblem | null = null;
    if (area && boulder) {
      const candidates = problems.filter(
        (item) => item.areaId === area.id && item.boulderId === boulder!.id
      );
      problem =
        (problemName ? findByName(candidates, problemName) : null) ??
        (problemJa ? findByName(candidates, problemJa) : null);

      if (!problem && grade) {
        const byGrade = candidates.filter((item) => {
          const nameMatch =
            (problemName &&
              (normalizeKey(item.nameEn) === normalizeKey(problemName) ||
                normalizeKey(item.nameJa) === normalizeKey(problemName))) ||
            (problemJa &&
              (normalizeKey(item.nameEn) === normalizeKey(problemJa) ||
                normalizeKey(item.nameJa) === normalizeKey(problemJa)));
          return nameMatch && normalizeKey(item.grade) === normalizeKey(grade);
        });
        problem = byGrade[0] ?? null;
      }
    }

    if (area && problem && boulder) {
      resolved.push({
        occurredAt,
        areaId: area.id,
        customAreaName: "",
        boulderId: boulder.id,
        problemId: problem.id,
        problemName: "",
        boulderName: "",
        grade: "",
        result,
        tryCount: asTryCount(get("try_count")),
        perceivedDifficulty: asPerceivedDifficulty(get("perceived_difficulty")),
        notes: get("notes"),
        sessionReflection: get("session_reflection")
      });
      continue;
    }

    // Fall back to a custom-area climb when names do not resolve in the offline topo.
    const customKey = normalizeKey(areaName);
    let areaId = customAreaIds.get(customKey);
    if (!areaId) {
      areaId = newId("custom");
      customAreaIds.set(customKey, areaId);
    }

    resolved.push({
      occurredAt,
      areaId,
      customAreaName: areaName,
      boulderId: boulderName ? newId("boulder") : "manual",
      problemId: newId("manual"),
      problemName: displayProblem,
      boulderName,
      grade,
      result,
      tryCount: asTryCount(get("try_count")),
      perceivedDifficulty: asPerceivedDifficulty(get("perceived_difficulty")),
      notes: get("notes"),
      sessionReflection: get("session_reflection")
    });
  }

  if (resolved.length === 0) {
    throw new Error("No spreadsheet rows could be imported.");
  }

  type SessionBucket = {
    session: ImportSessionRow;
    attempts: ImportAttemptRow[];
  };

  const buckets = new Map<string, SessionBucket>();

  for (const row of resolved) {
    const day = localDayKey(row.occurredAt)!;
    const key = `${row.areaId}|${row.customAreaName}|${day}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      const sessionId = newId("session");
      bucket = {
        session: {
          id: sessionId,
          area_id: row.areaId,
          custom_area_name: row.customAreaName,
          started_at: row.occurredAt,
          ended_at: row.occurredAt,
          energy: null,
          weather: null,
          mental: null,
          mood: null,
          skin: null,
          conditions: "",
          reflection: row.sessionReflection,
          notes: "",
          created_at: row.occurredAt,
          updated_at: row.occurredAt
        },
        attempts: []
      };
      buckets.set(key, bucket);
    } else {
      if (row.occurredAt < bucket.session.started_at) {
        bucket.session.started_at = row.occurredAt;
        bucket.session.created_at = row.occurredAt;
      }
      if (!bucket.session.ended_at || row.occurredAt > bucket.session.ended_at) {
        bucket.session.ended_at = row.occurredAt;
        bucket.session.updated_at = row.occurredAt;
      }
      if (!bucket.session.reflection && row.sessionReflection) {
        bucket.session.reflection = row.sessionReflection;
      }
    }

    const attemptId = newId("attempt");
    bucket.attempts.push({
      id: attemptId,
      session_id: bucket.session.id,
      area_id: row.areaId,
      boulder_id: row.boulderId,
      problem_id: row.problemId,
      problem_name: row.problemName,
      boulder_name: row.boulderName,
      grade: row.grade,
      occurred_at: row.occurredAt,
      result: row.result,
      try_count: row.tryCount,
      perceived_difficulty: row.perceivedDifficulty,
      notes: row.notes,
      created_at: row.occurredAt,
      updated_at: row.occurredAt
    });
  }

  const sessions = [...buckets.values()].map((bucket) => bucket.session);
  const attempts = [...buckets.values()].flatMap((bucket) => bucket.attempts);

  return {
    source: "csv",
    sessions,
    attempts,
    problemNotes: [],
    skipped
  };
}

function looksLikeCsv(fileName: string, text: string): boolean {
  if (fileName.toLowerCase().endsWith(".csv")) return true;
  const trimmed = text.trimStart();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return false;
  const firstLine = trimmed.split(/\r?\n/, 1)[0] ?? "";
  return firstLine.toLowerCase().includes("date") && firstLine.toLowerCase().includes("result");
}

/** Open the system file picker and parse a JSON backup or attempts spreadsheet. */
export async function pickAndParseImport(db: SQLiteDatabase): Promise<ImportLogPayload | null> {
  const picked = await File.pickFileAsync({
    mimeTypes: ["application/json", "text/csv", "text/comma-separated-values", "*/*"]
  });
  if (picked.canceled || !picked.result) return null;

  const file = picked.result;
  const text = await file.text();
  const fileName = file.name || "";

  if (looksLikeCsv(fileName, text)) {
    return parseCsvImport(db, text);
  }

  return parseJsonImport(text);
}
