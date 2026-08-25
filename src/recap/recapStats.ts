import { statsRanges } from "../db/repository";
import type { RecapBounds, RecapSummary } from "../domain/types";

export type RecapRangeMode = "progress" | "year";

export type RecapShareFormat = "stats" | "stories";

export type ProgressRangeKey = (typeof statsRanges)[number]["key"];

export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;

export function boundsForProgressRange(rangeKey: ProgressRangeKey): RecapBounds {
  const range = statsRanges.find((option) => option.key === rangeKey) ?? statsRanges[1]!;
  return { since: range.since, until: null };
}

export function boundsForCalendarYear(year: number): RecapBounds {
  return {
    since: new Date(Date.UTC(year, 0, 1)).toISOString(),
    until: new Date(Date.UTC(year + 1, 0, 1)).toISOString()
  };
}

export function resolveRecapBounds(
  mode: RecapRangeMode,
  rangeKey: ProgressRangeKey,
  year: number
): RecapBounds {
  return mode === "year" ? boundsForCalendarYear(year) : boundsForProgressRange(rangeKey);
}

export function formatOutdoorDuration(
  minutes: number,
  t: (key: string, params?: Record<string, string | number>) => string
): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return t("progress.recap.minutesOnly", { minutes: total });
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (mins === 0) return t("progress.recap.hoursOnly", { hours });
  return t("progress.recap.hoursMinutes", { hours, minutes: mins });
}

export function periodTitle(
  mode: RecapRangeMode,
  rangeKey: ProgressRangeKey,
  year: number,
  t: (key: string, params?: Record<string, string | number>) => string
): string {
  if (mode === "year") return t("progress.recap.periodYear", { year });
  switch (rangeKey) {
    case "1m":
      return t("progress.recap.period1m");
    case "3m":
      return t("progress.recap.period3m");
    case "1y":
      return t("progress.recap.period1y");
    case "all":
      return t("progress.recap.periodAll");
  }
}

export function isRecapEmpty(stats: RecapSummary): boolean {
  return stats.totalSessions === 0 && stats.totalSends === 0;
}

export type RecapSlideId =
  | "cover"
  | "daysOut"
  | "tops"
  | "problems"
  | "highPoint"
  | "hardestSends"
  | "homeCrag"
  | "otherAreas"
  | "gradeMix"
  | "outro";

export const RECAP_SLIDE_IDS: RecapSlideId[] = [
  "cover",
  "daysOut",
  "tops",
  "problems",
  "highPoint",
  "hardestSends",
  "homeCrag",
  "otherAreas",
  "gradeMix",
  "outro"
];
