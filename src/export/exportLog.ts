import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import type { SQLiteDatabase } from "expo-sqlite";

import { buildExportBundle } from "../db/repository";

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function exportLogAsJson(db: SQLiteDatabase): Promise<string> {
  const bundle = await buildExportBundle(db);
  const date = new Date().toISOString().slice(0, 10);
  const file = new File(Paths.cache, `opentopo-log-${date}.json`);
  file.write(JSON.stringify(bundle, null, 2));
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      dialogTitle: "Export Tick Mark log",
      mimeType: "application/json",
      UTI: "public.json"
    });
  }
  return file.uri;
}

export async function exportAttemptsAsCsv(db: SQLiteDatabase): Promise<string> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT
      attempt.occurred_at AS date,
      attempt.result,
      attempt.try_count,
      COALESCE(NULLIF(area.name_en, ''), area.name_ja, NULLIF(session.custom_area_name, ''), attempt.area_id) AS area,
      COALESCE(NULLIF(boulder.name_en, ''), boulder.name_ja, attempt.boulder_name, '') AS boulder,
      COALESCE(NULLIF(problem.name_en, ''), attempt.problem_name, '') AS problem,
      COALESCE(NULLIF(problem.name_ja, ''), attempt.problem_name, '') AS problem_ja,
      COALESCE(NULLIF(problem.grade, ''), attempt.grade, '') AS grade,
      attempt.perceived_difficulty,
      attempt.notes,
      session.reflection AS session_reflection
     FROM attempts attempt
     JOIN sessions session ON session.id = attempt.session_id
     LEFT JOIN topo_areas area ON area.id = attempt.area_id
     LEFT JOIN topo_boulders boulder ON boulder.area_id = attempt.area_id AND boulder.id = attempt.boulder_id
     LEFT JOIN topo_problems problem ON problem.area_id = attempt.area_id AND problem.id = attempt.problem_id
     ORDER BY attempt.occurred_at`
  );
  const headers = [
    "date",
    "result",
    "try_count",
    "area",
    "boulder",
    "problem",
    "problem_ja",
    "grade",
    "perceived_difficulty",
    "notes",
    "session_reflection"
  ];
  const csv = [
    headers.map(csvCell).join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))
  ].join("\n");
  const date = new Date().toISOString().slice(0, 10);
  const file = new File(Paths.cache, `opentopo-attempts-${date}.csv`);
  file.write(csv);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      dialogTitle: "Export Tick Mark attempts",
      mimeType: "text/csv",
      UTI: "public.comma-separated-values-text"
    });
  }
  return file.uri;
}
