import type { SQLiteDatabase } from "expo-sqlite";

import { datePrefix } from "../domain/topoVersion";
import type { TopoSeed } from "../domain/types";

export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  const result = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  const currentVersion = result?.user_version ?? 0;

  if (currentVersion < 1) {
    await db.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.execAsync(`
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS topo_areas (
        id TEXT PRIMARY KEY NOT NULL,
        name_ja TEXT NOT NULL DEFAULT '',
        name_en TEXT NOT NULL DEFAULT '',
        prefecture TEXT NOT NULL DEFAULT '',
        access_status TEXT NOT NULL DEFAULT 'unknown',
        access_note TEXT NOT NULL DEFAULT '',
        approach_minutes INTEGER,
        updated_at TEXT NOT NULL DEFAULT '',
        payload_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS topo_boulders (
        id TEXT NOT NULL,
        area_id TEXT NOT NULL,
        name_ja TEXT NOT NULL DEFAULT '',
        name_en TEXT NOT NULL DEFAULT '',
        payload_json TEXT NOT NULL,
        PRIMARY KEY (area_id, id)
      );

      CREATE TABLE IF NOT EXISTS topo_problems (
        id TEXT NOT NULL,
        area_id TEXT NOT NULL,
        boulder_id TEXT NOT NULL,
        name_ja TEXT NOT NULL DEFAULT '',
        name_en TEXT NOT NULL DEFAULT '',
        grade TEXT NOT NULL DEFAULT '',
        style TEXT NOT NULL DEFAULT '',
        landing TEXT NOT NULL DEFAULT '',
        payload_json TEXT NOT NULL,
        PRIMARY KEY (area_id, id)
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY NOT NULL,
        area_id TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        energy INTEGER,
        mood INTEGER,
        skin INTEGER,
        conditions TEXT NOT NULL DEFAULT '',
        reflection TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS attempts (
        id TEXT PRIMARY KEY NOT NULL,
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        area_id TEXT NOT NULL,
        boulder_id TEXT NOT NULL,
        problem_id TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        result TEXT NOT NULL CHECK (result IN ('attempt', 'send', 'flash')),
        perceived_difficulty INTEGER NOT NULL DEFAULT 0 CHECK (perceived_difficulty BETWEEN -2 AND 2),
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS problem_notes (
        id TEXT PRIMARY KEY NOT NULL,
        area_id TEXT NOT NULL,
        problem_id TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_problem_area ON topo_problems(area_id);
      CREATE INDEX IF NOT EXISTS idx_attempt_session ON attempts(session_id);
      CREATE INDEX IF NOT EXISTS idx_attempt_problem ON attempts(area_id, problem_id);
      CREATE INDEX IF NOT EXISTS idx_attempt_occurred ON attempts(occurred_at);
      CREATE INDEX IF NOT EXISTS idx_session_started ON sessions(started_at);
      PRAGMA user_version = 1;
      `);
    });
  }

  if (currentVersion < 2) {
    await db.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.execAsync(`
        ALTER TABLE attempts ADD COLUMN try_count INTEGER NOT NULL DEFAULT 1 CHECK (try_count >= 1);
        PRAGMA user_version = 2;
      `);
    });
  }

  if (currentVersion < 3) {
    await db.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.execAsync(`
        ALTER TABLE sessions ADD COLUMN custom_area_name TEXT NOT NULL DEFAULT '';
        ALTER TABLE attempts ADD COLUMN problem_name TEXT NOT NULL DEFAULT '';
        ALTER TABLE attempts ADD COLUMN boulder_name TEXT NOT NULL DEFAULT '';
        ALTER TABLE attempts ADD COLUMN grade TEXT NOT NULL DEFAULT '';
        PRAGMA user_version = 3;
      `);
    });
  }

  if (currentVersion < 4) {
    await db.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.execAsync(`
        ALTER TABLE sessions ADD COLUMN mental INTEGER;
        PRAGMA user_version = 4;
      `);
    });
  }

  if (currentVersion < 5) {
    await db.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.execAsync(`
        ALTER TABLE sessions ADD COLUMN weather INTEGER;
        UPDATE sessions SET weather = mental WHERE weather IS NULL AND mental IS NOT NULL;
        PRAGMA user_version = 5;
      `);
    });
  }
}

function styleValue(style: unknown): string {
  if (Array.isArray(style)) return style.join(", ");
  return typeof style === "string" ? style : "";
}

export async function replaceTopoData(db: SQLiteDatabase, seed: TopoSeed): Promise<void> {
  await db.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.execAsync("DELETE FROM topo_problems; DELETE FROM topo_boulders; DELETE FROM topo_areas;");

    for (const area of seed.areas) {
      await transaction.runAsync(
        `INSERT INTO topo_areas
          (id, name_ja, name_en, prefecture, access_status, access_note, approach_minutes, updated_at, payload_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        area.id,
        area.nameJa ?? "",
        area.nameEn ?? "",
        area.prefecture ?? "",
        area.accessStatus ?? "unknown",
        area.accessNote ?? "",
        area.approachMinutes ?? null,
        area.updated ?? "",
        JSON.stringify(area)
      );

      for (const boulder of area.boulders ?? []) {
        await transaction.runAsync(
          `INSERT INTO topo_boulders (id, area_id, name_ja, name_en, payload_json)
           VALUES (?, ?, ?, ?, ?)`,
          boulder.id,
          area.id,
          boulder.nameJa ?? "",
          boulder.nameEn ?? "",
          JSON.stringify(boulder)
        );

        for (const problem of boulder.problems ?? []) {
          await transaction.runAsync(
            `INSERT INTO topo_problems
              (id, area_id, boulder_id, name_ja, name_en, grade, style, landing, payload_json)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            problem.id,
            area.id,
            boulder.id,
            problem.nameJa ?? "",
            problem.nameEn ?? "",
            problem.grade ?? "",
            styleValue(problem.style),
            problem.landing ?? "",
            JSON.stringify(problem)
          );
        }
      }
    }

    await transaction.runAsync(
      `INSERT INTO metadata (key, value) VALUES ('topo_version', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      seed.version
    );
  });
}

export async function seedTopoIfNeeded(db: SQLiteDatabase, seed: TopoSeed): Promise<void> {
  const stored = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM topo_areas");
  const fingerprint = [
    seed.schemaVersion,
    seed.version,
    seed.areas.length,
    seed.areas.reduce((count, area) => count + (area.boulders?.length ?? 0), 0),
    seed.areas.reduce(
      (count, area) => count + (area.boulders ?? []).reduce((areaCount, boulder) => areaCount + (boulder.problems?.length ?? 0), 0),
      0
    )
  ].join(":");
  const [storedFingerprint, storedTopoVersion] = await Promise.all([
    db.getFirstAsync<{ value: string }>("SELECT value FROM metadata WHERE key = 'bundled_seed_fingerprint'"),
    db.getFirstAsync<{ value: string }>("SELECT value FROM metadata WHERE key = 'topo_version'")
  ]);
  if (storedFingerprint?.value === fingerprint) return;

  const shouldRefresh =
    (stored?.count ?? 0) === 0 ||
    !storedTopoVersion?.value ||
    storedTopoVersion.value <= seed.version;
  if (!shouldRefresh) return;

  await replaceTopoData(db, seed);
  await db.runAsync(
    `INSERT INTO metadata (key, value) VALUES ('bundled_seed_fingerprint', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    fingerprint
  );
}

/** Older GitHub downloads stored a SHA as topo_version; surface the latest area date instead. */
async function normalizeTopoVersionLabel(db: SQLiteDatabase): Promise<void> {
  const stored = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM metadata WHERE key = 'topo_version'"
  );
  if (datePrefix(stored?.value ?? "")) return;
  const latest = await db.getFirstAsync<{ updatedAt: string | null }>(
    "SELECT MAX(updated_at) AS updatedAt FROM topo_areas WHERE updated_at != ''"
  );
  const next = datePrefix(latest?.updatedAt ?? "");
  if (!next) return;
  await db.runAsync(
    `INSERT INTO metadata (key, value) VALUES ('topo_version', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    next
  );
}

export async function initializeDatabase(db: SQLiteDatabase, seed: TopoSeed): Promise<void> {
  await migrateDatabase(db);
  await seedTopoIfNeeded(db, seed);
  await normalizeTopoVersionLabel(db);
}
