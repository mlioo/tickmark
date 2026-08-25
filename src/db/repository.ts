import type { SQLiteDatabase } from "expo-sqlite";

import { datePrefix } from "../domain/topoVersion";
import type {
  AreaRow,
  AttemptResult,
  AttemptRow,
  BoulderRow,
  ExportBundle,
  ImportAttemptRow,
  ImportLogPayload,
  ImportMode,
  ImportProblemNoteRow,
  ImportResult,
  ImportSessionRow,
  LogAttemptRow,
  PerceivedDifficulty,
  ProblemRow,
  AreaStatsSummary,
  RecapBounds,
  RecapSummary,
  SessionRow,
  StatsRange,
  StatsSummary
} from "../domain/types";
import { averageGrade, dankyuGradesMatchingQuery, gradeRank, type GradeSystem } from "../domain/grades";
import { localizedName, type AppLocale } from "../i18n/language";
import type { LanguagePreference } from "../i18n/language";
import type { ThemePreference } from "../theme/theme";

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function displayName(japanese: string, english: string, locale: AppLocale = "en"): string {
  return localizedName(japanese, english, locale, "Unnamed");
}

/** Shared session projection: topo names win; otherwise custom_area_name. */
const SESSION_SELECT = `
  session.id,
  session.area_id AS areaId,
  COALESCE(NULLIF(area.name_en, ''), area.name_ja, NULLIF(session.custom_area_name, ''), session.area_id) AS areaName,
  CASE
    WHEN area.id IS NOT NULL THEN COALESCE(area.name_ja, '')
    ELSE session.custom_area_name
  END AS areaNameJa,
  CASE
    WHEN area.id IS NOT NULL THEN COALESCE(area.name_en, '')
    ELSE session.custom_area_name
  END AS areaNameEn,
  COALESCE(session.custom_area_name, '') AS customAreaName,
  session.started_at AS startedAt,
  session.ended_at AS endedAt,
  session.energy,
  COALESCE(session.weather, session.mental) AS weather,
  session.mood,
  session.skin,
  session.conditions,
  session.reflection,
  session.notes,
  COALESCE(SUM(attempt.try_count), 0) AS attemptCount,
  COALESCE(SUM(CASE WHEN attempt.result IN ('send', 'flash') THEN 1 ELSE 0 END), 0) AS sendCount
`;

/** Shared attempt projection with topo fallbacks to denormalized manual fields. */
const LOG_ATTEMPT_SELECT = `
  attempt.id,
  attempt.session_id AS sessionId,
  attempt.area_id AS areaId,
  attempt.problem_id AS problemId,
  COALESCE(NULLIF(problem.name_en, ''), problem.name_ja, NULLIF(attempt.problem_name, ''), attempt.problem_id) AS problemName,
  COALESCE(NULLIF(problem.name_ja, ''), attempt.problem_name, '') AS problemNameJa,
  COALESCE(NULLIF(problem.name_en, ''), attempt.problem_name, '') AS problemNameEn,
  COALESCE(
    NULLIF(area.name_en, ''),
    area.name_ja,
    NULLIF(session.custom_area_name, ''),
    attempt.area_id
  ) AS areaName,
  CASE
    WHEN area.id IS NOT NULL THEN COALESCE(area.name_ja, '')
    ELSE COALESCE(session.custom_area_name, '')
  END AS areaNameJa,
  CASE
    WHEN area.id IS NOT NULL THEN COALESCE(area.name_en, '')
    ELSE COALESCE(session.custom_area_name, '')
  END AS areaNameEn,
  COALESCE(NULLIF(boulder.name_en, ''), boulder.name_ja, NULLIF(attempt.boulder_name, '')) AS boulderName,
  COALESCE(NULLIF(boulder.name_ja, ''), attempt.boulder_name, '') AS boulderNameJa,
  COALESCE(NULLIF(boulder.name_en, ''), attempt.boulder_name, '') AS boulderNameEn,
  COALESCE(NULLIF(problem.grade, ''), attempt.grade, '') AS grade,
  attempt.result,
  attempt.try_count AS tryCount,
  attempt.perceived_difficulty AS perceivedDifficulty,
  attempt.notes,
  attempt.occurred_at AS occurredAt,
  COALESCE((
    SELECT note.body
    FROM problem_notes note
    WHERE note.area_id = attempt.area_id AND note.problem_id = attempt.problem_id
    ORDER BY note.updated_at DESC
    LIMIT 1
  ), '') AS problemNote
`;

export async function getLanguagePreference(db: SQLiteDatabase): Promise<LanguagePreference> {
  const result = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM metadata WHERE key = 'language_preference'"
  );
  return result?.value === "en" || result?.value === "ja" ? result.value : "system";
}

export async function saveLanguagePreference(db: SQLiteDatabase, preference: LanguagePreference): Promise<void> {
  await db.runAsync(
    `INSERT INTO metadata (key, value) VALUES ('language_preference', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    preference
  );
}

export const statsRanges: StatsRange[] = [
  { key: "1m", label: "1M", since: new Date(Date.now() - 30 * 86400000).toISOString() },
  { key: "3m", label: "3M", since: new Date(Date.now() - 91 * 86400000).toISOString() },
  { key: "1y", label: "1Y", since: new Date(Date.now() - 365 * 86400000).toISOString() },
  { key: "all", label: "ALL", since: null }
];

export async function getTopoVersion(db: SQLiteDatabase): Promise<string> {
  const result = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM metadata WHERE key = 'topo_version'"
  );
  const stored = result?.value ?? "";
  const storedDate = datePrefix(stored);
  if (storedDate) return storedDate;
  const latest = await db.getFirstAsync<{ updatedAt: string | null }>(
    "SELECT MAX(updated_at) AS updatedAt FROM topo_areas WHERE updated_at != ''"
  );
  return datePrefix(latest?.updatedAt ?? "") ?? stored ?? "unknown";
}

export async function getThemePreference(db: SQLiteDatabase): Promise<ThemePreference> {
  const result = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM metadata WHERE key = 'theme_preference'"
  );
  return result?.value === "light" || result?.value === "dark" ? result.value : "system";
}

export async function saveThemePreference(db: SQLiteDatabase, preference: ThemePreference): Promise<void> {
  await db.runAsync(
    `INSERT INTO metadata (key, value) VALUES ('theme_preference', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    preference
  );
}

export async function getGradeSystemPreference(db: SQLiteDatabase): Promise<GradeSystem> {
  const result = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM metadata WHERE key = 'grade_system_preference'"
  );
  return result?.value === "vscale" ? "vscale" : "dankyu";
}

export async function saveGradeSystemPreference(db: SQLiteDatabase, preference: GradeSystem): Promise<void> {
  await db.runAsync(
    `INSERT INTO metadata (key, value) VALUES ('grade_system_preference', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    preference
  );
}

export async function getAreas(db: SQLiteDatabase, query = ""): Promise<AreaRow[]> {
  const search = `%${query.trim()}%`;
  return db.getAllAsync<AreaRow>(
    `SELECT
      area.id,
      area.name_ja AS nameJa,
      area.name_en AS nameEn,
      area.prefecture,
      area.access_status AS accessStatus,
      area.access_note AS accessNote,
      area.approach_minutes AS approachMinutes,
      area.updated_at AS updatedAt,
      COUNT(problem.id) AS problemCount,
      area.payload_json AS payloadJson
     FROM topo_areas area
     LEFT JOIN topo_problems problem ON problem.area_id = area.id
     WHERE (? = '%%' OR area.name_ja LIKE ? OR area.name_en LIKE ? OR area.prefecture LIKE ?)
     GROUP BY area.id
     ORDER BY area.name_en, area.name_ja`,
    search,
    search,
    search,
    search
  );
}

export async function getArea(db: SQLiteDatabase, areaId: string): Promise<AreaRow | null> {
  return db.getFirstAsync<AreaRow>(
    `SELECT
      area.id,
      area.name_ja AS nameJa,
      area.name_en AS nameEn,
      area.prefecture,
      area.access_status AS accessStatus,
      area.access_note AS accessNote,
      area.approach_minutes AS approachMinutes,
      area.updated_at AS updatedAt,
      COUNT(problem.id) AS problemCount,
      area.payload_json AS payloadJson
     FROM topo_areas area
     LEFT JOIN topo_problems problem ON problem.area_id = area.id
     WHERE area.id = ?
     GROUP BY area.id`,
    areaId
  );
}

export async function getBoulders(db: SQLiteDatabase, areaId: string): Promise<BoulderRow[]> {
  return db.getAllAsync<BoulderRow>(
    `SELECT
      boulder.id,
      boulder.area_id AS areaId,
      boulder.name_ja AS nameJa,
      boulder.name_en AS nameEn,
      COUNT(problem.id) AS problemCount,
      boulder.payload_json AS payloadJson
     FROM topo_boulders boulder
     LEFT JOIN topo_problems problem
       ON problem.area_id = boulder.area_id AND problem.boulder_id = boulder.id
     WHERE boulder.area_id = ?
     GROUP BY boulder.area_id, boulder.id
     ORDER BY boulder.name_en, boulder.name_ja`,
    areaId
  );
}

export async function getProblems(
  db: SQLiteDatabase,
  areaId: string,
  query = ""
): Promise<ProblemRow[]> {
  const trimmed = query.trim();
  const search = `%${trimmed}%`;
  const gradeAliases = dankyuGradesMatchingQuery(trimmed);
  const gradeClauses = gradeAliases.map(() => "problem.grade = ?").join(" OR ");
  const gradeFilter = gradeClauses ? ` OR ${gradeClauses}` : "";
  return db.getAllAsync<ProblemRow>(
    `SELECT
      problem.id,
      problem.area_id AS areaId,
      problem.boulder_id AS boulderId,
      COALESCE(area.name_en, area.name_ja) AS areaName,
      COALESCE(area.name_ja, '') AS areaNameJa,
      COALESCE(area.name_en, '') AS areaNameEn,
      COALESCE(NULLIF(boulder.name_en, ''), boulder.name_ja) AS boulderName,
      COALESCE(boulder.name_ja, '') AS boulderNameJa,
      COALESCE(boulder.name_en, '') AS boulderNameEn,
      problem.name_ja AS nameJa,
      problem.name_en AS nameEn,
      problem.grade,
      problem.style,
      problem.landing,
      problem.payload_json AS payloadJson,
      boulder.payload_json AS boulderPayloadJson
     FROM topo_problems problem
     JOIN topo_areas area ON area.id = problem.area_id
     JOIN topo_boulders boulder ON boulder.area_id = problem.area_id AND boulder.id = problem.boulder_id
     WHERE problem.area_id = ?
       AND (? = '%%' OR problem.name_ja LIKE ? OR problem.name_en LIKE ? OR problem.grade LIKE ? OR boulder.name_ja LIKE ? OR boulder.name_en LIKE ?${gradeFilter})
     ORDER BY boulder.name_en, boulder.name_ja, problem.grade, problem.name_en, problem.name_ja`,
    areaId,
    search,
    search,
    search,
    search,
    search,
    search,
    ...gradeAliases
  );
}

export async function getProblem(
  db: SQLiteDatabase,
  areaId: string,
  problemId: string
): Promise<ProblemRow | null> {
  return db.getFirstAsync<ProblemRow>(
    `SELECT
      problem.id,
      problem.area_id AS areaId,
      problem.boulder_id AS boulderId,
      COALESCE(area.name_en, area.name_ja) AS areaName,
      COALESCE(area.name_ja, '') AS areaNameJa,
      COALESCE(area.name_en, '') AS areaNameEn,
      COALESCE(NULLIF(boulder.name_en, ''), boulder.name_ja) AS boulderName,
      COALESCE(boulder.name_ja, '') AS boulderNameJa,
      COALESCE(boulder.name_en, '') AS boulderNameEn,
      problem.name_ja AS nameJa,
      problem.name_en AS nameEn,
      problem.grade,
      problem.style,
      problem.landing,
      problem.payload_json AS payloadJson,
      boulder.payload_json AS boulderPayloadJson
     FROM topo_problems problem
     JOIN topo_areas area ON area.id = problem.area_id
     JOIN topo_boulders boulder ON boulder.area_id = problem.area_id AND boulder.id = problem.boulder_id
     WHERE problem.area_id = ? AND problem.id = ?`,
    areaId,
    problemId
  );
}

export async function getOpenSession(db: SQLiteDatabase): Promise<SessionRow | null> {
  return db.getFirstAsync<SessionRow>(
    `SELECT ${SESSION_SELECT}
     FROM sessions session
     LEFT JOIN topo_areas area ON area.id = session.area_id
     LEFT JOIN attempts attempt ON attempt.session_id = session.id
     WHERE session.ended_at IS NULL
     GROUP BY session.id
     ORDER BY session.started_at DESC
     LIMIT 1`
  );
}

export async function getRecentSessions(db: SQLiteDatabase, limit = 20): Promise<SessionRow[]> {
  return db.getAllAsync<SessionRow>(
    `SELECT ${SESSION_SELECT}
     FROM sessions session
     LEFT JOIN topo_areas area ON area.id = session.area_id
     LEFT JOIN attempts attempt ON attempt.session_id = session.id
     GROUP BY session.id
     ORDER BY session.started_at DESC
     LIMIT ?`,
    limit
  );
}

export async function getSessionById(db: SQLiteDatabase, sessionId: string): Promise<SessionRow | null> {
  return db.getFirstAsync<SessionRow>(
    `SELECT ${SESSION_SELECT}
     FROM sessions session
     LEFT JOIN topo_areas area ON area.id = session.area_id
     LEFT JOIN attempts attempt ON attempt.session_id = session.id
     WHERE session.id = ?
     GROUP BY session.id
     LIMIT 1`,
    sessionId
  );
}

export async function getSessionsInRange(
  db: SQLiteDatabase,
  start: string,
  end: string
): Promise<SessionRow[]> {
  return db.getAllAsync<SessionRow>(
    `SELECT ${SESSION_SELECT}
     FROM sessions session
     LEFT JOIN topo_areas area ON area.id = session.area_id
     LEFT JOIN attempts attempt ON attempt.session_id = session.id
     WHERE session.ended_at IS NOT NULL AND session.started_at >= ? AND session.started_at < ?
     GROUP BY session.id
     ORDER BY session.started_at DESC`,
    start,
    end
  );
}

export async function getSessionAttempts(db: SQLiteDatabase, sessionId: string): Promise<LogAttemptRow[]> {
  return db.getAllAsync<LogAttemptRow>(
    `SELECT ${LOG_ATTEMPT_SELECT}
     FROM attempts attempt
     LEFT JOIN sessions session ON session.id = attempt.session_id
     LEFT JOIN topo_problems problem ON problem.area_id = attempt.area_id AND problem.id = attempt.problem_id
     LEFT JOIN topo_areas area ON area.id = attempt.area_id
     LEFT JOIN topo_boulders boulder ON boulder.area_id = attempt.area_id AND boulder.id = attempt.boulder_id
     WHERE attempt.session_id = ?
     ORDER BY attempt.occurred_at DESC`,
    sessionId
  );
}

export async function getSentProblems(db: SQLiteDatabase, limit = 500): Promise<LogAttemptRow[]> {
  return db.getAllAsync<LogAttemptRow>(
    `SELECT ${LOG_ATTEMPT_SELECT}
     FROM attempts attempt
     LEFT JOIN sessions session ON session.id = attempt.session_id
     LEFT JOIN topo_problems problem ON problem.area_id = attempt.area_id AND problem.id = attempt.problem_id
     LEFT JOIN topo_areas area ON area.id = attempt.area_id
     LEFT JOIN topo_boulders boulder ON boulder.area_id = attempt.area_id AND boulder.id = attempt.boulder_id
     WHERE attempt.result IN ('send', 'flash')
     ORDER BY attempt.occurred_at DESC
     LIMIT ?`,
    limit
  );
}

export async function getProblemAttempts(
  db: SQLiteDatabase,
  areaId: string,
  problemId: string
): Promise<AttemptRow[]> {
  return db.getAllAsync<AttemptRow>(
    `SELECT
      attempt.id,
      attempt.session_id AS sessionId,
      attempt.problem_id AS problemId,
      COALESCE(NULLIF(problem.name_en, ''), problem.name_ja, NULLIF(attempt.problem_name, ''), attempt.problem_id) AS problemName,
      COALESCE(NULLIF(problem.name_ja, ''), attempt.problem_name, '') AS problemNameJa,
      COALESCE(NULLIF(problem.name_en, ''), attempt.problem_name, '') AS problemNameEn,
      COALESCE(NULLIF(problem.grade, ''), attempt.grade, '') AS grade,
      attempt.result,
      attempt.try_count AS tryCount,
      attempt.perceived_difficulty AS perceivedDifficulty,
      attempt.notes,
      attempt.occurred_at AS occurredAt
     FROM attempts attempt
     LEFT JOIN topo_problems problem ON problem.area_id = attempt.area_id AND problem.id = attempt.problem_id
     WHERE attempt.area_id = ? AND attempt.problem_id = ?
     ORDER BY attempt.occurred_at DESC`,
    areaId,
    problemId
  );
}

export async function startSession(db: SQLiteDatabase, areaId: string): Promise<string> {
  const existing = await getOpenSession(db);
  if (existing) return existing.id;

  const now = new Date().toISOString();
  const id = newId("session");
  await db.runAsync(
    `INSERT INTO sessions (id, area_id, custom_area_name, started_at, created_at, updated_at)
     VALUES (?, ?, '', ?, ?, ?)`,
    id,
    areaId,
    now,
    now,
    now
  );
  return id;
}

export async function startCustomSession(db: SQLiteDatabase, areaName: string): Promise<string> {
  const existing = await getOpenSession(db);
  if (existing) return existing.id;

  const name = areaName.trim();
  if (!name) throw new Error("Area name is required.");

  const now = new Date().toISOString();
  const id = newId("session");
  const areaId = newId("custom");
  await db.runAsync(
    `INSERT INTO sessions (id, area_id, custom_area_name, started_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    id,
    areaId,
    name,
    now,
    now,
    now
  );
  return id;
}

export async function saveAttempt(
  db: SQLiteDatabase,
  input: {
    areaId: string;
    boulderId?: string;
    problemId?: string;
    problemName?: string;
    boulderName?: string;
    grade?: string;
    result: AttemptResult;
    tryCount: number;
    perceivedDifficulty: PerceivedDifficulty;
    notes: string;
  }
): Promise<string> {
  let session = await getOpenSession(db);
  if (!session || session.areaId !== input.areaId) {
    if (session) {
      throw new Error(`Finish your ${session.areaName} session before logging another area.`);
    }
    if (input.problemName) {
      throw new Error("Start a session before logging a manual climb.");
    }
    const sessionId = await startSession(db, input.areaId);
    session = await getOpenSession(db);
    if (!session) throw new Error(`Could not open session ${sessionId}.`);
  }

  const problemName = input.problemName?.trim() ?? "";
  const boulderName = input.boulderName?.trim() ?? "";
  const grade = input.grade?.trim() ?? "";
  const problemId = input.problemId ?? newId("manual");
  const boulderId = input.boulderId ?? (boulderName ? newId("boulder") : "manual");

  const now = new Date().toISOString();
  const id = newId("attempt");
  await db.runAsync(
    `INSERT INTO attempts
      (id, session_id, area_id, boulder_id, problem_id, problem_name, boulder_name, grade,
       occurred_at, result, try_count, perceived_difficulty, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    session.id,
    input.areaId,
    boulderId,
    problemId,
    problemName,
    boulderName,
    grade,
    now,
    input.result,
    Math.max(1, Math.round(input.tryCount)),
    input.perceivedDifficulty,
    input.notes.trim(),
    now,
    now
  );
  return id;
}

export async function finishSession(
  db: SQLiteDatabase,
  sessionId: string,
  input: {
    energy: number;
    weather: number;
    mood: number;
    skin: number;
    conditions: string;
    reflection: string;
  }
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE sessions
     SET ended_at = ?, energy = ?, weather = ?, mood = ?, skin = ?, conditions = ?, reflection = ?, updated_at = ?
     WHERE id = ?`,
    now,
    input.energy,
    input.weather,
    input.mood,
    input.skin,
    input.conditions.trim(),
    input.reflection.trim(),
    now,
    sessionId
  );
}

export async function getProblemNote(
  db: SQLiteDatabase,
  areaId: string,
  problemId: string
): Promise<string> {
  const result = await db.getFirstAsync<{ body: string }>(
    `SELECT body FROM problem_notes WHERE area_id = ? AND problem_id = ? ORDER BY updated_at DESC LIMIT 1`,
    areaId,
    problemId
  );
  return result?.body ?? "";
}

export async function saveProblemNote(
  db: SQLiteDatabase,
  areaId: string,
  problemId: string,
  body: string
): Promise<void> {
  const now = new Date().toISOString();
  const existing = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM problem_notes WHERE area_id = ? AND problem_id = ? LIMIT 1",
    areaId,
    problemId
  );
  if (existing) {
    await db.runAsync(
      "UPDATE problem_notes SET body = ?, updated_at = ? WHERE id = ?",
      body.trim(),
      now,
      existing.id
    );
    return;
  }
  await db.runAsync(
    `INSERT INTO problem_notes (id, area_id, problem_id, body, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    newId("note"),
    areaId,
    problemId,
    body.trim(),
    now,
    now
  );
}

function safeNumber(value: number | null | undefined): number {
  return Number(value ?? 0);
}

export async function getStats(db: SQLiteDatabase, since: string | null, locale: AppLocale = "en"): Promise<StatsSummary> {
  const [totals, gradeRows, gradeAttemptRows, areaRows, tripRows, sendRows] = await Promise.all([
    db.getFirstAsync<{ totalAttempts: number; totalSends: number; totalSessions: number }>(
      `SELECT
        COALESCE(SUM(attempt.try_count), 0) AS totalAttempts,
        COUNT(DISTINCT CASE WHEN attempt.result IN ('send', 'flash') THEN attempt.id END) AS totalSends,
        COUNT(DISTINCT session.id) AS totalSessions
       FROM sessions session
       LEFT JOIN attempts attempt ON attempt.session_id = session.id
       WHERE (? IS NULL OR session.started_at >= ?)`,
      since,
      since
    ),
    db.getAllAsync<{ label: string; value: number }>(
      `SELECT COALESCE(NULLIF(problem.grade, ''), NULLIF(attempt.grade, ''), '?') AS label, COUNT(*) AS value
       FROM attempts attempt
       LEFT JOIN topo_problems problem ON problem.area_id = attempt.area_id AND problem.id = attempt.problem_id
       WHERE attempt.result IN ('send', 'flash') AND (? IS NULL OR attempt.occurred_at >= ?)
       GROUP BY COALESCE(NULLIF(problem.grade, ''), NULLIF(attempt.grade, ''), '?')`,
      since,
      since
    ),
    db.getAllAsync<{ label: string; attempts: number; sends: number }>(
      `SELECT
        COALESCE(NULLIF(problem.grade, ''), NULLIF(attempt.grade, ''), '?') AS label,
        COALESCE(SUM(attempt.try_count), 0) AS attempts,
        SUM(CASE WHEN attempt.result IN ('send', 'flash') THEN 1 ELSE 0 END) AS sends
       FROM attempts attempt
       LEFT JOIN topo_problems problem ON problem.area_id = attempt.area_id AND problem.id = attempt.problem_id
       WHERE (? IS NULL OR attempt.occurred_at >= ?)
       GROUP BY COALESCE(NULLIF(problem.grade, ''), NULLIF(attempt.grade, ''), '?')
       HAVING SUM(CASE WHEN attempt.result IN ('send', 'flash') THEN 1 ELSE 0 END) > 0`,
      since,
      since
    ),
    db.getAllAsync<{ id: string; nameJa: string; nameEn: string; value: number }>(
      `SELECT
        attempt.area_id AS id,
        CASE
          WHEN area.id IS NOT NULL THEN COALESCE(area.name_ja, '')
          ELSE COALESCE(session.custom_area_name, '')
        END AS nameJa,
        CASE
          WHEN area.id IS NOT NULL THEN COALESCE(area.name_en, '')
          ELSE COALESCE(session.custom_area_name, '')
        END AS nameEn,
        COUNT(*) AS value
       FROM attempts attempt
       LEFT JOIN sessions session ON session.id = attempt.session_id
       LEFT JOIN topo_areas area ON area.id = attempt.area_id
       WHERE attempt.result IN ('send', 'flash') AND (? IS NULL OR attempt.occurred_at >= ?)
       GROUP BY attempt.area_id
       ORDER BY value DESC`,
      since,
      since
    ),
    db.getAllAsync<{ label: string; value: number }>(
      `SELECT strftime('%Y-%m', started_at) AS label, COUNT(*) AS value
       FROM sessions
       WHERE (? IS NULL OR started_at >= ?)
       GROUP BY label
       ORDER BY label DESC
       LIMIT 12`,
      since,
      since
    ),
    db.getAllAsync<{ occurredAt: string; grade: string }>(
      `SELECT attempt.occurred_at AS occurredAt, COALESCE(NULLIF(problem.grade, ''), attempt.grade, '') AS grade
       FROM attempts attempt
       LEFT JOIN topo_problems problem ON problem.area_id = attempt.area_id AND problem.id = attempt.problem_id
       WHERE attempt.result IN ('send', 'flash') AND (? IS NULL OR attempt.occurred_at >= ?)
       ORDER BY attempt.occurred_at`,
      since,
      since
    )
  ]);

  const totalAttempts = safeNumber(totals?.totalAttempts);
  const totalSends = safeNumber(totals?.totalSends);
  const progressionMap = new Map<string, { grade: string; rank: number }>();
  let hardestGrade = "—";
  let hardestRank = -1;

  for (const row of sendRows) {
    const rank = gradeRank(row.grade);
    if (rank > hardestRank) {
      hardestRank = rank;
      hardestGrade = row.grade;
    }
    const month = row.occurredAt.slice(0, 7);
    const current = progressionMap.get(month);
    if (!current || rank > current.rank) progressionMap.set(month, { grade: row.grade, rank });
  }

  return {
    totalSends,
    totalAttempts,
    totalSessions: safeNumber(totals?.totalSessions),
    sendRate: totalAttempts === 0 ? 0 : Math.round((totalSends / totalAttempts) * 100),
    averageAttemptsPerSend: totalSends === 0 ? 0 : Number((totalAttempts / totalSends).toFixed(1)),
    hardestGrade,
    gradeSends: gradeRows
      .map((row) => ({ label: row.label, value: safeNumber(row.value) }))
      .sort((a, b) => gradeRank(a.label) - gradeRank(b.label)),
    gradeAttempts: gradeAttemptRows
      .map((row) => ({
        label: row.label,
        attempts: safeNumber(row.attempts),
        sends: safeNumber(row.sends),
        averageAttemptsPerSend: Number((safeNumber(row.attempts) / Math.max(1, safeNumber(row.sends))).toFixed(1))
      }))
      .sort((a, b) => gradeRank(a.label) - gradeRank(b.label)),
    areaSends: areaRows.map((row) => ({
      id: row.id,
      label: displayName(row.nameJa, row.nameEn, locale),
      value: safeNumber(row.value)
    })),
    monthlyTrips: tripRows
      .map((row) => ({ label: row.label, value: safeNumber(row.value) }))
      .reverse(),
    progression: [...progressionMap.entries()].map(([label, value]) => ({ label, ...value }))
  };
}

/** Session/attempt started_at / occurred_at within [since, until). Null bounds are open. */
function rangeParams(bounds: RecapBounds): [string | null, string | null, string | null, string | null] {
  return [bounds.since, bounds.since, bounds.until, bounds.until];
}

const RANGE_SESSION = `(? IS NULL OR session.started_at >= ?) AND (? IS NULL OR session.started_at < ?)`;
const RANGE_ATTEMPT = `(? IS NULL OR attempt.occurred_at >= ?) AND (? IS NULL OR attempt.occurred_at < ?)`;

export async function listSessionYears(db: SQLiteDatabase): Promise<number[]> {
  const rows = await db.getAllAsync<{ year: string }>(
    `SELECT DISTINCT strftime('%Y', started_at) AS year
     FROM sessions
     WHERE started_at IS NOT NULL
     ORDER BY year DESC`
  );
  return rows.map((row) => Number(row.year)).filter((year) => Number.isFinite(year));
}

export async function getRecapStats(
  db: SQLiteDatabase,
  bounds: RecapBounds,
  locale: AppLocale = "en"
): Promise<RecapSummary> {
  const params = rangeParams(bounds);
  const [totals, outdoor, areaRows, gradeRows, sendRows] = await Promise.all([
    db.getFirstAsync<{
      totalSends: number;
      flashCount: number;
      uniqueProblemsSent: number;
      totalSessions: number;
    }>(
      `SELECT
        COUNT(DISTINCT CASE WHEN attempt.result IN ('send', 'flash') THEN attempt.id END) AS totalSends,
        COUNT(DISTINCT CASE WHEN attempt.result = 'flash' THEN attempt.id END) AS flashCount,
        COUNT(DISTINCT CASE
          WHEN attempt.result IN ('send', 'flash')
          THEN attempt.area_id || '|' || attempt.problem_id
        END) AS uniqueProblemsSent,
        COUNT(DISTINCT session.id) AS totalSessions
       FROM sessions session
       LEFT JOIN attempts attempt ON attempt.session_id = session.id
       WHERE ${RANGE_SESSION}`,
      ...params
    ),
    db.getFirstAsync<{ outdoorMinutes: number }>(
      `SELECT COALESCE(SUM(
          (julianday(session.ended_at) - julianday(session.started_at)) * 24 * 60
        ), 0) AS outdoorMinutes
       FROM sessions session
       WHERE session.ended_at IS NOT NULL AND ${RANGE_SESSION}`,
      ...params
    ),
    db.getAllAsync<{
      id: string;
      nameJa: string;
      nameEn: string;
      sessionCount: number;
      sendCount: number;
    }>(
      `SELECT
        session.area_id AS id,
        CASE
          WHEN area.id IS NOT NULL THEN COALESCE(area.name_ja, '')
          ELSE COALESCE(session.custom_area_name, '')
        END AS nameJa,
        CASE
          WHEN area.id IS NOT NULL THEN COALESCE(area.name_en, '')
          ELSE COALESCE(session.custom_area_name, '')
        END AS nameEn,
        COUNT(DISTINCT session.id) AS sessionCount,
        COUNT(DISTINCT CASE WHEN attempt.result IN ('send', 'flash') THEN attempt.id END) AS sendCount
       FROM sessions session
       LEFT JOIN topo_areas area ON area.id = session.area_id
       LEFT JOIN attempts attempt ON attempt.session_id = session.id
       WHERE ${RANGE_SESSION}
       GROUP BY session.area_id
       ORDER BY sessionCount DESC, sendCount DESC`,
      ...params
    ),
    db.getAllAsync<{ label: string; value: number }>(
      `SELECT COALESCE(NULLIF(problem.grade, ''), NULLIF(attempt.grade, ''), '?') AS label, COUNT(*) AS value
       FROM attempts attempt
       LEFT JOIN topo_problems problem ON problem.area_id = attempt.area_id AND problem.id = attempt.problem_id
       WHERE attempt.result IN ('send', 'flash') AND ${RANGE_ATTEMPT}
       GROUP BY COALESCE(NULLIF(problem.grade, ''), NULLIF(attempt.grade, ''), '?')`,
      ...params
    ),
    db.getAllAsync<{
      problemKey: string;
      problemId: string;
      nameJa: string;
      nameEn: string;
      areaNameJa: string;
      areaNameEn: string;
      grade: string;
    }>(
      `SELECT
        attempt.area_id || '|' || attempt.problem_id AS problemKey,
        attempt.problem_id AS problemId,
        COALESCE(NULLIF(problem.name_ja, ''), attempt.problem_name, '') AS nameJa,
        COALESCE(NULLIF(problem.name_en, ''), attempt.problem_name, '') AS nameEn,
        CASE
          WHEN area.id IS NOT NULL THEN COALESCE(area.name_ja, '')
          ELSE COALESCE(session.custom_area_name, '')
        END AS areaNameJa,
        CASE
          WHEN area.id IS NOT NULL THEN COALESCE(area.name_en, '')
          ELSE COALESCE(session.custom_area_name, '')
        END AS areaNameEn,
        COALESCE(NULLIF(problem.grade, ''), attempt.grade, '') AS grade
       FROM attempts attempt
       LEFT JOIN sessions session ON session.id = attempt.session_id
       LEFT JOIN topo_areas area ON area.id = attempt.area_id
       LEFT JOIN topo_problems problem ON problem.area_id = attempt.area_id AND problem.id = attempt.problem_id
       WHERE attempt.result IN ('send', 'flash') AND ${RANGE_ATTEMPT}`,
      ...params
    )
  ]);

  const bestByProblem = new Map<
    string,
    { problemId: string; nameJa: string; nameEn: string; areaNameJa: string; areaNameEn: string; grade: string; rank: number }
  >();
  for (const row of sendRows) {
    const rank = gradeRank(row.grade);
    if (rank < 0) continue;
    const current = bestByProblem.get(row.problemKey);
    if (!current || rank > current.rank) {
      bestByProblem.set(row.problemKey, {
        problemId: row.problemId,
        nameJa: row.nameJa,
        nameEn: row.nameEn,
        areaNameJa: row.areaNameJa,
        areaNameEn: row.areaNameEn,
        grade: row.grade,
        rank
      });
    }
  }

  const rankedHardSends = [...bestByProblem.values()]
    .sort((a, b) => b.rank - a.rank)
    .map((row) => ({
      problemId: row.problemId,
      problemName: displayName(row.nameJa, row.nameEn, locale),
      areaName: displayName(row.areaNameJa, row.areaNameEn, locale),
      grade: row.grade
    }));

  const hardestSend = rankedHardSends[0] ?? null;
  /** Next three after the single hardest send (ranks 2–4). */
  const hardestSends = rankedHardSends.slice(1, 4);
  const hardestGrade = hardestSend?.grade ?? "—";
  const meanGrade = averageGrade(sendRows.map((row) => row.grade));

  const rankedAreas = areaRows
    .filter((row) => safeNumber(row.sessionCount) > 0)
    .map((row) => ({
      id: row.id,
      label: displayName(row.nameJa, row.nameEn, locale),
      sessionCount: safeNumber(row.sessionCount),
      sendCount: safeNumber(row.sendCount)
    }));
  const topArea = rankedAreas[0] ?? null;
  const otherAreas = rankedAreas.slice(1);

  return {
    totalSends: safeNumber(totals?.totalSends),
    flashCount: safeNumber(totals?.flashCount),
    uniqueProblemsSent: safeNumber(totals?.uniqueProblemsSent),
    totalSessions: safeNumber(totals?.totalSessions),
    outdoorMinutes: Math.max(0, Math.round(safeNumber(outdoor?.outdoorMinutes))),
    hardestGrade,
    averageGrade: meanGrade,
    hardestSend,
    hardestSends,
    topArea,
    otherAreas,
    gradeSends: gradeRows
      .map((row) => ({ label: row.label, value: safeNumber(row.value) }))
      .sort((a, b) => safeNumber(b.value) - safeNumber(a.value) || gradeRank(b.label) - gradeRank(a.label)),
    periodStart: bounds.since,
    periodEnd: bounds.until
  };
}

export async function getAreaStats(
  db: SQLiteDatabase,
  since: string | null,
  areaId: string,
  locale: AppLocale = "en"
): Promise<AreaStatsSummary> {
  const [areaRow, totals, gradeRows, gradeAttemptRows, sendRows] = await Promise.all([
    db.getFirstAsync<{ id: string; nameJa: string; nameEn: string }>(
      `SELECT
        attempt.area_id AS id,
        CASE
          WHEN area.id IS NOT NULL THEN COALESCE(area.name_ja, '')
          ELSE COALESCE(session.custom_area_name, '')
        END AS nameJa,
        CASE
          WHEN area.id IS NOT NULL THEN COALESCE(area.name_en, '')
          ELSE COALESCE(session.custom_area_name, '')
        END AS nameEn
       FROM attempts attempt
       LEFT JOIN sessions session ON session.id = attempt.session_id
       LEFT JOIN topo_areas area ON area.id = attempt.area_id
       WHERE attempt.area_id = ?
       LIMIT 1`,
      areaId
    ),
    db.getFirstAsync<{ totalAttempts: number; totalSends: number; totalSessions: number }>(
      `SELECT
        COALESCE(SUM(attempt.try_count), 0) AS totalAttempts,
        COUNT(DISTINCT CASE WHEN attempt.result IN ('send', 'flash') THEN attempt.id END) AS totalSends,
        COUNT(DISTINCT attempt.session_id) AS totalSessions
       FROM attempts attempt
       WHERE attempt.area_id = ? AND (? IS NULL OR attempt.occurred_at >= ?)`,
      areaId,
      since,
      since
    ),
    db.getAllAsync<{ label: string; value: number }>(
      `SELECT COALESCE(NULLIF(problem.grade, ''), NULLIF(attempt.grade, ''), '?') AS label, COUNT(*) AS value
       FROM attempts attempt
       LEFT JOIN topo_problems problem ON problem.area_id = attempt.area_id AND problem.id = attempt.problem_id
       WHERE attempt.area_id = ?
         AND attempt.result IN ('send', 'flash')
         AND (? IS NULL OR attempt.occurred_at >= ?)
       GROUP BY COALESCE(NULLIF(problem.grade, ''), NULLIF(attempt.grade, ''), '?')`,
      areaId,
      since,
      since
    ),
    db.getAllAsync<{ label: string; attempts: number; sends: number }>(
      `SELECT
        COALESCE(NULLIF(problem.grade, ''), NULLIF(attempt.grade, ''), '?') AS label,
        COALESCE(SUM(attempt.try_count), 0) AS attempts,
        SUM(CASE WHEN attempt.result IN ('send', 'flash') THEN 1 ELSE 0 END) AS sends
       FROM attempts attempt
       LEFT JOIN topo_problems problem ON problem.area_id = attempt.area_id AND problem.id = attempt.problem_id
       WHERE attempt.area_id = ? AND (? IS NULL OR attempt.occurred_at >= ?)
       GROUP BY COALESCE(NULLIF(problem.grade, ''), NULLIF(attempt.grade, ''), '?')
       HAVING SUM(CASE WHEN attempt.result IN ('send', 'flash') THEN 1 ELSE 0 END) > 0`,
      areaId,
      since,
      since
    ),
    db.getAllAsync<{ grade: string }>(
      `SELECT COALESCE(NULLIF(problem.grade, ''), attempt.grade, '') AS grade
       FROM attempts attempt
       LEFT JOIN topo_problems problem ON problem.area_id = attempt.area_id AND problem.id = attempt.problem_id
       WHERE attempt.area_id = ?
         AND attempt.result IN ('send', 'flash')
         AND (? IS NULL OR attempt.occurred_at >= ?)`,
      areaId,
      since,
      since
    )
  ]);

  let hardestGrade = "—";
  let hardestRank = -1;
  for (const row of sendRows) {
    const rank = gradeRank(row.grade);
    if (rank > hardestRank) {
      hardestRank = rank;
      hardestGrade = row.grade;
    }
  }

  return {
    areaId,
    areaName: areaRow ? displayName(areaRow.nameJa, areaRow.nameEn, locale) : areaId,
    totalSends: safeNumber(totals?.totalSends),
    totalAttempts: safeNumber(totals?.totalAttempts),
    totalSessions: safeNumber(totals?.totalSessions),
    hardestGrade,
    gradeSends: gradeRows
      .map((row) => ({ label: row.label, value: safeNumber(row.value) }))
      .sort((a, b) => gradeRank(a.label) - gradeRank(b.label)),
    gradeAttempts: gradeAttemptRows
      .map((row) => ({
        label: row.label,
        attempts: safeNumber(row.attempts),
        sends: safeNumber(row.sends),
        averageAttemptsPerSend: Number((safeNumber(row.attempts) / Math.max(1, safeNumber(row.sends))).toFixed(1))
      }))
      .sort((a, b) => gradeRank(a.label) - gradeRank(b.label))
  };
}

export async function buildExportBundle(db: SQLiteDatabase): Promise<ExportBundle> {
  const [topoVersion, sessions, attempts, problemNotes] = await Promise.all([
    getTopoVersion(db),
    db.getAllAsync<Record<string, unknown>>("SELECT * FROM sessions ORDER BY started_at"),
    db.getAllAsync<Record<string, unknown>>("SELECT * FROM attempts ORDER BY occurred_at"),
    db.getAllAsync<Record<string, unknown>>("SELECT * FROM problem_notes ORDER BY created_at")
  ]);
  return {
    format: "opentopo-log",
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    topoVersion,
    sessions,
    attempts,
    problemNotes
  };
}

async function insertSession(
  transaction: SQLiteDatabase,
  session: ImportSessionRow,
  mode: ImportMode
): Promise<void> {
  const weather = session.weather ?? session.mental;
  if (mode === "merge") {
    await transaction.runAsync(
      `INSERT INTO sessions
        (id, area_id, custom_area_name, started_at, ended_at, energy, weather, mood, skin, conditions, reflection, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         area_id = excluded.area_id,
         custom_area_name = excluded.custom_area_name,
         started_at = excluded.started_at,
         ended_at = excluded.ended_at,
         energy = excluded.energy,
         weather = excluded.weather,
         mood = excluded.mood,
         skin = excluded.skin,
         conditions = excluded.conditions,
         reflection = excluded.reflection,
         notes = excluded.notes,
         created_at = excluded.created_at,
         updated_at = excluded.updated_at`,
      session.id,
      session.area_id,
      session.custom_area_name,
      session.started_at,
      session.ended_at,
      session.energy,
      weather,
      session.mood,
      session.skin,
      session.conditions,
      session.reflection,
      session.notes,
      session.created_at,
      session.updated_at
    );
    return;
  }

  await transaction.runAsync(
    `INSERT INTO sessions
      (id, area_id, custom_area_name, started_at, ended_at, energy, weather, mood, skin, conditions, reflection, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    session.id,
    session.area_id,
    session.custom_area_name,
    session.started_at,
    session.ended_at,
    session.energy,
    weather,
    session.mood,
    session.skin,
    session.conditions,
    session.reflection,
    session.notes,
    session.created_at,
    session.updated_at
  );
}

async function insertAttempt(
  transaction: SQLiteDatabase,
  attempt: ImportAttemptRow,
  mode: ImportMode
): Promise<void> {
  if (mode === "merge") {
    await transaction.runAsync(
      `INSERT INTO attempts
        (id, session_id, area_id, boulder_id, problem_id, problem_name, boulder_name, grade,
         occurred_at, result, try_count, perceived_difficulty, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         session_id = excluded.session_id,
         area_id = excluded.area_id,
         boulder_id = excluded.boulder_id,
         problem_id = excluded.problem_id,
         problem_name = excluded.problem_name,
         boulder_name = excluded.boulder_name,
         grade = excluded.grade,
         occurred_at = excluded.occurred_at,
         result = excluded.result,
         try_count = excluded.try_count,
         perceived_difficulty = excluded.perceived_difficulty,
         notes = excluded.notes,
         created_at = excluded.created_at,
         updated_at = excluded.updated_at`,
      attempt.id,
      attempt.session_id,
      attempt.area_id,
      attempt.boulder_id,
      attempt.problem_id,
      attempt.problem_name,
      attempt.boulder_name,
      attempt.grade,
      attempt.occurred_at,
      attempt.result,
      attempt.try_count,
      attempt.perceived_difficulty,
      attempt.notes,
      attempt.created_at,
      attempt.updated_at
    );
    return;
  }

  await transaction.runAsync(
    `INSERT INTO attempts
      (id, session_id, area_id, boulder_id, problem_id, problem_name, boulder_name, grade,
       occurred_at, result, try_count, perceived_difficulty, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    attempt.id,
    attempt.session_id,
    attempt.area_id,
    attempt.boulder_id,
    attempt.problem_id,
    attempt.problem_name,
    attempt.boulder_name,
    attempt.grade,
    attempt.occurred_at,
    attempt.result,
    attempt.try_count,
    attempt.perceived_difficulty,
    attempt.notes,
    attempt.created_at,
    attempt.updated_at
  );
}

async function insertProblemNote(
  transaction: SQLiteDatabase,
  note: ImportProblemNoteRow,
  mode: ImportMode
): Promise<void> {
  if (mode === "merge") {
    await transaction.runAsync(
      `INSERT INTO problem_notes (id, area_id, problem_id, body, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         area_id = excluded.area_id,
         problem_id = excluded.problem_id,
         body = excluded.body,
         created_at = excluded.created_at,
         updated_at = excluded.updated_at`,
      note.id,
      note.area_id,
      note.problem_id,
      note.body,
      note.created_at,
      note.updated_at
    );
    return;
  }

  await transaction.runAsync(
    `INSERT INTO problem_notes (id, area_id, problem_id, body, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    note.id,
    note.area_id,
    note.problem_id,
    note.body,
    note.created_at,
    note.updated_at
  );
}

/** Wipe private climbing log tables. Topo content and preferences are kept. */
export async function clearClimbingLog(db: SQLiteDatabase): Promise<void> {
  await db.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.execAsync(`
      DELETE FROM attempts;
      DELETE FROM sessions;
      DELETE FROM problem_notes;
    `);
  });
}

/** Replace or merge private climbing log tables from a parsed import payload. */
export async function importLogData(
  db: SQLiteDatabase,
  payload: ImportLogPayload,
  mode: ImportMode
): Promise<ImportResult> {
  await db.withExclusiveTransactionAsync(async (transaction) => {
    if (mode === "replace") {
      await transaction.execAsync(`
        DELETE FROM attempts;
        DELETE FROM sessions;
        DELETE FROM problem_notes;
      `);
    }

    for (const session of payload.sessions) {
      await insertSession(transaction, session, mode);
    }
    for (const attempt of payload.attempts) {
      await insertAttempt(transaction, attempt, mode);
    }
    for (const note of payload.problemNotes) {
      await insertProblemNote(transaction, note, mode);
    }
  });

  return {
    sessions: payload.sessions.length,
    attempts: payload.attempts.length,
    notes: payload.problemNotes.length,
    skipped: payload.skipped
  };
}
