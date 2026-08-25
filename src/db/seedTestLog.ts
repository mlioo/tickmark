import type { SQLiteDatabase } from "expo-sqlite";

import type { AttemptResult, PerceivedDifficulty } from "../domain/types";

type SampleAttempt = {
  boulderId: string;
  problemId: string;
  hoursAfterStart: number;
  result: AttemptResult;
  tryCount: number;
  perceivedDifficulty: PerceivedDifficulty;
  notes?: string;
};

type SampleSession = {
  id: string;
  areaId: string;
  /** Days ago from local midnight; negative means in the future (unused). */
  daysAgo: number;
  startHour: number;
  durationHours: number;
  energy: number;
  weather: number;
  mood: number;
  skin: number;
  conditions: string;
  reflection: string;
  attempts: SampleAttempt[];
};

type SampleNote = {
  id: string;
  areaId: string;
  problemId: string;
  body: string;
};

function atLocalDay(daysAgo: number, hour: number, minute = 0): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function hoursLater(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * 3600000).toISOString();
}

/** Realistic multi-month history across real topo IDs for Progress + Log Book QA. */
const SAMPLE_SESSIONS: SampleSession[] = [
  {
    id: "sample_session_01",
    areaId: "kasama",
    daysAgo: 110,
    startHour: 9,
    durationHours: 4.5,
    energy: 4,
    weather: 5,
    mood: 5,
    skin: 4,
    conditions: "Cool morning, dry granite",
    reflection: "First proper day at Kasama. Focused on easy volume and learning the approach.",
    attempts: [
      { boulderId: "way-of-gill", problemId: "kasama-003-ol-mantle", hoursAfterStart: 0.5, result: "flash", tryCount: 1, perceivedDifficulty: -1, notes: "Short and fun" },
      { boulderId: "way-of-gill", problemId: "kasama-002-lo-mantle", hoursAfterStart: 0.8, result: "send", tryCount: 2, perceivedDifficulty: 0 },
      { boulderId: "way-of-gill", problemId: "kasama-006-kante", hoursAfterStart: 1.4, result: "send", tryCount: 3, perceivedDifficulty: 0 },
      { boulderId: "fan-iwa", problemId: "kasama-019-mantle", hoursAfterStart: 2.2, result: "flash", tryCount: 1, perceivedDifficulty: -2 },
      { boulderId: "hip-iwa", problemId: "kasama-040-face-man", hoursAfterStart: 2.8, result: "send", tryCount: 2, perceivedDifficulty: -1 },
      { boulderId: "sekijin", problemId: "kasama-030-jump-club", hoursAfterStart: 3.5, result: "attempt", tryCount: 4, perceivedDifficulty: 1, notes: "Need better footwork on the jump" }
    ]
  },
  {
    id: "sample_session_02",
    areaId: "kasama",
    daysAgo: 96,
    startHour: 10,
    durationHours: 5,
    energy: 3,
    weather: 4,
    mood: 4,
    skin: 3,
    conditions: "Warm / slight breeze",
    reflection: "Working into the mid grades. Love Touch felt close.",
    attempts: [
      { boulderId: "love-touch", problemId: "kasama-011-love-kante", hoursAfterStart: 0.4, result: "send", tryCount: 3, perceivedDifficulty: 0 },
      { boulderId: "love-touch", problemId: "kasama-012-love-touch", hoursAfterStart: 1.2, result: "attempt", tryCount: 6, perceivedDifficulty: 1, notes: "Crux slap keeps slipping" },
      { boulderId: "love-touch", problemId: "kasama-013-target", hoursAfterStart: 2.5, result: "send", tryCount: 4, perceivedDifficulty: 0 },
      { boulderId: "fan-iwa", problemId: "kasama-015-spark-traverse", hoursAfterStart: 3.4, result: "send", tryCount: 5, perceivedDifficulty: 1 },
      { boulderId: "fan-iwa", problemId: "kasama-016-magic-finger", hoursAfterStart: 4.2, result: "flash", tryCount: 1, perceivedDifficulty: -1 }
    ]
  },
  {
    id: "sample_session_03",
    areaId: "mitake",
    daysAgo: 82,
    startHour: 8,
    durationHours: 6,
    energy: 5,
    weather: 5,
    mood: 5,
    skin: 2,
    conditions: "River humidity, shady",
    reflection: "Classic Mitake day. Skin took a beating but the line quality is unreal.",
    attempts: [
      { boulderId: "dead-end-boulder", problemId: "mitake-005-l", hoursAfterStart: 1, result: "send", tryCount: 4, perceivedDifficulty: 0 },
      { boulderId: "dead-end-boulder", problemId: "mitake-005-c", hoursAfterStart: 2.5, result: "attempt", tryCount: 8, perceivedDifficulty: 2, notes: "Power move off the undercling" },
      { boulderId: "ninja-iwa", problemId: "mitake-093-e", hoursAfterStart: 4, result: "attempt", tryCount: 5, perceivedDifficulty: 1 },
      { boulderId: "ninja-iwa", problemId: "mitake-093-d", hoursAfterStart: 5, result: "attempt", tryCount: 3, perceivedDifficulty: 1 }
    ]
  },
  {
    id: "sample_session_04",
    areaId: "kasama",
    daysAgo: 70,
    startHour: 9,
    durationHours: 4,
    energy: 4,
    weather: 4,
    mood: 4,
    skin: 3,
    conditions: "Perfect friction",
    reflection: "Sent Love Touch. Progression feels real.",
    attempts: [
      { boulderId: "love-touch", problemId: "kasama-012-love-touch", hoursAfterStart: 0.5, result: "send", tryCount: 3, perceivedDifficulty: 0, notes: "Committed to the slap" },
      { boulderId: "bench", problemId: "kasama-001-sd", hoursAfterStart: 1.5, result: "send", tryCount: 2, perceivedDifficulty: 0 },
      { boulderId: "way-of-gill", problemId: "kasama-004-way-of-gill", hoursAfterStart: 2.2, result: "attempt", tryCount: 7, perceivedDifficulty: 1 },
      { boulderId: "way-of-gill", problemId: "kasama-007-gold-finger", hoursAfterStart: 3.3, result: "send", tryCount: 4, perceivedDifficulty: 0 }
    ]
  },
  {
    id: "sample_session_05",
    areaId: "shiobara",
    daysAgo: 58,
    startHour: 7,
    durationHours: 5.5,
    energy: 4,
    weather: 5,
    mood: 5,
    skin: 4,
    conditions: "Crisp / dry",
    reflection: "Road trip vibes. Alterna felt soft for the grade today.",
    attempts: [
      { boulderId: "shiobara-same-iwa", problemId: "shiobara-002", hoursAfterStart: 1, result: "send", tryCount: 5, perceivedDifficulty: -1, notes: "Heel-toe kept me on" },
      { boulderId: "shiobara-mizu-iwa", problemId: "shiobara-017", hoursAfterStart: 2.5, result: "attempt", tryCount: 6, perceivedDifficulty: 2 },
      { boulderId: "shiobara-nodate-iwa", problemId: "shiobara-067", hoursAfterStart: 4, result: "flash", tryCount: 1, perceivedDifficulty: 0 }
    ]
  },
  {
    id: "sample_session_06",
    areaId: "mitsumine",
    daysAgo: 49,
    startHour: 10,
    durationHours: 4,
    energy: 3,
    weather: 3,
    mood: 3,
    skin: 3,
    conditions: "Cloudy, a bit greasy",
    reflection: "Short session. Silkhat projects will need cooler temps.",
    attempts: [
      { boulderId: "mitsumine-problem-list", problemId: "mitsumine-white-001", hoursAfterStart: 0.5, result: "send", tryCount: 4, perceivedDifficulty: 0 },
      { boulderId: "mitsumine-problem-list", problemId: "mitsumine-silkhat-a", hoursAfterStart: 1.8, result: "attempt", tryCount: 5, perceivedDifficulty: 1 },
      { boulderId: "mitsumine-problem-list", problemId: "mitsumine-silkhat-g", hoursAfterStart: 3, result: "attempt", tryCount: 3, perceivedDifficulty: 2 }
    ]
  },
  {
    id: "sample_session_07",
    areaId: "kasama",
    daysAgo: 41,
    startHour: 9,
    durationHours: 5,
    energy: 5,
    weather: 5,
    mood: 5,
    skin: 3,
    conditions: "Cool shade after rain yesterday",
    reflection: "Way of Gill finally went. Best day of the season so far.",
    attempts: [
      { boulderId: "way-of-gill", problemId: "kasama-004-way-of-gill", hoursAfterStart: 0.6, result: "send", tryCount: 5, perceivedDifficulty: 0, notes: "Micro beta on the right foot" },
      { boulderId: "way-of-gill", problemId: "kasama-005-super-star", hoursAfterStart: 2, result: "attempt", tryCount: 6, perceivedDifficulty: 1 },
      { boulderId: "simple-iwa", problemId: "kasama-022-simple-and-deep", hoursAfterStart: 3.2, result: "attempt", tryCount: 4, perceivedDifficulty: 1 },
      { boulderId: "sekijin", problemId: "kasama-028-sekijin-slab-center", hoursAfterStart: 4.2, result: "send", tryCount: 3, perceivedDifficulty: 0 }
    ]
  },
  {
    id: "sample_session_08",
    areaId: "mitake",
    daysAgo: 33,
    startHour: 8,
    durationHours: 5.5,
    energy: 4,
    weather: 4,
    mood: 4,
    skin: 2,
    conditions: "Humid but climbable",
    reflection: "Project day. Camp felt doable; frog still spit me off.",
    attempts: [
      { boulderId: "dead-end-boulder", problemId: "mitake-005-c", hoursAfterStart: 1, result: "send", tryCount: 6, perceivedDifficulty: 1, notes: "Linked from the undercling" },
      { boulderId: "ninja-iwa", problemId: "mitake-093-e", hoursAfterStart: 3, result: "attempt", tryCount: 7, perceivedDifficulty: 1 },
      { boulderId: "ninja-iwa", problemId: "mitake-093-c", hoursAfterStart: 4.5, result: "attempt", tryCount: 2, perceivedDifficulty: 2 }
    ]
  },
  {
    id: "sample_session_09",
    areaId: "okura",
    daysAgo: 26,
    startHour: 11,
    durationHours: 3.5,
    energy: 3,
    weather: 4,
    mood: 4,
    skin: 4,
    conditions: "Quiet weekday",
    reflection: "Exploring Okura. Soft rock, careful landing checks.",
    attempts: [
      { boulderId: "okura-problem-list", problemId: "okura-007", hoursAfterStart: 0.8, result: "attempt", tryCount: 5, perceivedDifficulty: 1 },
      { boulderId: "okura-problem-list", problemId: "okura-007", hoursAfterStart: 2.5, result: "attempt", tryCount: 3, perceivedDifficulty: 1, notes: "Closer on the exit" }
    ]
  },
  {
    id: "sample_session_10",
    areaId: "kasama",
    daysAgo: 21,
    startHour: 9,
    durationHours: 4.5,
    energy: 4,
    weather: 5,
    mood: 5,
    skin: 3,
    conditions: "Ideal friction",
    reflection: "First 1段 send with Simple & Deep. Super Star next.",
    attempts: [
      { boulderId: "simple-iwa", problemId: "kasama-022-simple-and-deep", hoursAfterStart: 0.5, result: "send", tryCount: 4, perceivedDifficulty: 0, notes: "Trust the deep lock" },
      { boulderId: "simple-iwa", problemId: "kasama-023-emotion", hoursAfterStart: 1.8, result: "attempt", tryCount: 5, perceivedDifficulty: 1 },
      { boulderId: "way-of-gill", problemId: "kasama-005-super-star", hoursAfterStart: 3, result: "attempt", tryCount: 4, perceivedDifficulty: 1 },
      { boulderId: "sekijin", problemId: "kasama-034-q-ban", hoursAfterStart: 4, result: "attempt", tryCount: 3, perceivedDifficulty: 2 }
    ]
  },
  {
    id: "sample_session_11",
    areaId: "shiobara",
    daysAgo: 14,
    startHour: 7,
    durationHours: 6,
    energy: 5,
    weather: 4,
    mood: 4,
    skin: 2,
    conditions: "Cold start, perfect by 10",
    reflection: "Tried Hyper Ballad for the first time. Way above me, but fun to touch.",
    attempts: [
      { boulderId: "shiobara-same-iwa", problemId: "shiobara-002", hoursAfterStart: 0.5, result: "flash", tryCount: 1, perceivedDifficulty: -1 },
      { boulderId: "shiobara-mizu-iwa", problemId: "shiobara-017", hoursAfterStart: 2, result: "send", tryCount: 8, perceivedDifficulty: 1, notes: "Finally stuck the crux" },
      { boulderId: "shiobara-o-iwa", problemId: "shiobara-047", hoursAfterStart: 4.5, result: "attempt", tryCount: 3, perceivedDifficulty: 2, notes: "Just feeling moves" }
    ]
  },
  {
    id: "sample_session_12",
    areaId: "kasama",
    daysAgo: 9,
    startHour: 10,
    durationHours: 4,
    energy: 3,
    weather: 4,
    mood: 4,
    skin: 3,
    conditions: "Warm afternoon",
    reflection: "Volume day after Shiobara. Kept grades honest.",
    attempts: [
      { boulderId: "hip-iwa", problemId: "kasama-036-aero-dancer", hoursAfterStart: 0.4, result: "send", tryCount: 2, perceivedDifficulty: 0 },
      { boulderId: "hip-iwa", problemId: "kasama-038-under-traverse", hoursAfterStart: 1.2, result: "send", tryCount: 3, perceivedDifficulty: 0 },
      { boulderId: "etsuko-iwa", problemId: "kasama-049-kante", hoursAfterStart: 2.2, result: "flash", tryCount: 1, perceivedDifficulty: -1 },
      { boulderId: "etsuko-iwa", problemId: "kasama-050-etsuko-no-xxxxx", hoursAfterStart: 2.8, result: "send", tryCount: 4, perceivedDifficulty: 0 },
      { boulderId: "sunshine", problemId: "kasama-053-sunshine", hoursAfterStart: 3.5, result: "attempt", tryCount: 5, perceivedDifficulty: 1 }
    ]
  },
  {
    id: "sample_session_13",
    areaId: "mitake",
    daysAgo: 4,
    startHour: 8,
    durationHours: 5,
    energy: 4,
    weather: 5,
    mood: 5,
    skin: 3,
    conditions: "Dry rock, busy weekend",
    reflection: "Frog went! Celebrated with easier laps.",
    attempts: [
      { boulderId: "ninja-iwa", problemId: "mitake-093-e", hoursAfterStart: 1, result: "send", tryCount: 4, perceivedDifficulty: 0, notes: "Quiet feet on the slab exit" },
      { boulderId: "ninja-iwa", problemId: "mitake-093-d", hoursAfterStart: 2.8, result: "attempt", tryCount: 4, perceivedDifficulty: 1 },
      { boulderId: "dead-end-boulder", problemId: "mitake-005-l", hoursAfterStart: 4, result: "flash", tryCount: 1, perceivedDifficulty: -1 }
    ]
  },
  {
    id: "sample_session_14",
    areaId: "kasama",
    daysAgo: 1,
    startHour: 9,
    durationHours: 3.5,
    energy: 4,
    weather: 4,
    mood: 4,
    skin: 4,
    conditions: "Cool / dry",
    reflection: "Short session before work. Super Star one move away.",
    attempts: [
      { boulderId: "way-of-gill", problemId: "kasama-005-super-star", hoursAfterStart: 0.5, result: "attempt", tryCount: 6, perceivedDifficulty: 1, notes: "Fell matching the rail" },
      { boulderId: "simple-iwa", problemId: "kasama-023-emotion", hoursAfterStart: 2, result: "send", tryCount: 3, perceivedDifficulty: 0 },
      { boulderId: "poko-iwa", problemId: "kasama-054-lipless-traverse", hoursAfterStart: 2.8, result: "send", tryCount: 5, perceivedDifficulty: 1 }
    ]
  }
];

const SAMPLE_NOTES: SampleNote[] = [
  {
    id: "sample_note_01",
    areaId: "kasama",
    problemId: "kasama-012-love-touch",
    body: "Right hand slap — left toe high first. Don't rush the match."
  },
  {
    id: "sample_note_02",
    areaId: "kasama",
    problemId: "kasama-004-way-of-gill",
    body: "Micro right foot before the crux pull. Chalk the left sidepull."
  },
  {
    id: "sample_note_03",
    areaId: "mitake",
    problemId: "mitake-005-c",
    body: "Set hips early on the undercling; left heel helps the slap."
  },
  {
    id: "sample_note_04",
    areaId: "shiobara",
    problemId: "shiobara-017",
    body: "Rest on the jug before the crux. Dry the right hand twice."
  }
];

export type SeedSampleLogResult = {
  sessions: number;
  attempts: number;
  notes: number;
};

/**
 * Replaces private climbing log tables with a fixed sample history.
 * Uses real topo problem IDs so Progress / Log Book resolve names and grades.
 */
export async function seedSampleLogData(db: SQLiteDatabase): Promise<SeedSampleLogResult> {
  let attemptCount = 0;
  const now = new Date().toISOString();

  await db.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.execAsync(`
      DELETE FROM attempts;
      DELETE FROM sessions;
      DELETE FROM problem_notes;
    `);

    for (const session of SAMPLE_SESSIONS) {
      const startedAt = atLocalDay(session.daysAgo, session.startHour);
      const endedAt = hoursLater(startedAt, session.durationHours);

      await transaction.runAsync(
        `INSERT INTO sessions
          (id, area_id, started_at, ended_at, energy, weather, mood, skin, conditions, reflection, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?)`,
        session.id,
        session.areaId,
        startedAt,
        endedAt,
        session.energy,
        session.weather,
        session.mood,
        session.skin,
        session.conditions,
        session.reflection,
        startedAt,
        endedAt
      );

      for (const [index, attempt] of session.attempts.entries()) {
        const occurredAt = hoursLater(startedAt, attempt.hoursAfterStart);
        const attemptId = `${session.id}_a${String(index + 1).padStart(2, "0")}`;
        await transaction.runAsync(
          `INSERT INTO attempts
            (id, session_id, area_id, boulder_id, problem_id, occurred_at, result, try_count, perceived_difficulty, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          attemptId,
          session.id,
          session.areaId,
          attempt.boulderId,
          attempt.problemId,
          occurredAt,
          attempt.result,
          attempt.tryCount,
          attempt.perceivedDifficulty,
          attempt.notes ?? "",
          occurredAt,
          occurredAt
        );
        attemptCount += 1;
      }
    }

    for (const note of SAMPLE_NOTES) {
      await transaction.runAsync(
        `INSERT INTO problem_notes (id, area_id, problem_id, body, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        note.id,
        note.areaId,
        note.problemId,
        note.body,
        now,
        now
      );
    }
  });

  return {
    sessions: SAMPLE_SESSIONS.length,
    attempts: attemptCount,
    notes: SAMPLE_NOTES.length
  };
}
