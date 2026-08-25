export type AttemptResult = "attempt" | "send" | "flash";

export type PerceivedDifficulty = -2 | -1 | 0 | 1 | 2;

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface MapPosition {
  x: number;
  y: number;
}

export interface TopoPhotoSeed {
  id: string;
  src: string;
  caption?: string;
  width?: number;
  height?: number;
  [key: string]: unknown;
}

export interface TopoProblemSeed {
  id: string;
  nameJa?: string;
  nameEn?: string;
  grade?: string;
  style?: string | string[];
  landing?: string;
  photoId?: string;
  line?: [number, number][];
  startHolds?: [number, number][];
  restrictedHolds?: [number, number][];
  restrictedLines?: [number, number][][];
  restrictionNote?: string;
  [key: string]: unknown;
}

export interface TopoBoulderSeed {
  id: string;
  nameJa?: string;
  nameEn?: string;
  coordinates?: Coordinates;
  map?: MapPosition;
  photos?: TopoPhotoSeed[];
  problems?: TopoProblemSeed[];
  [key: string]: unknown;
}

export type ParkingAvailability = "limited" | "available";

export type ParkingLotType = "unknown" | "paid" | "limited" | "free";

export interface TopoParkingLot {
  name: string;
  type?: ParkingLotType | string;
  capacity?: string;
  coordinates?: Coordinates;
  googleMapsUrl?: string;
  notes?: string;
  notesEn?: string;
  notesJa?: string;
  warnings?: string[];
  warningsEn?: string[];
  warningsJa?: string[];
  [key: string]: unknown;
}

export interface TopoAreaSeed {
  id: string;
  nameJa?: string;
  nameEn?: string;
  prefecture?: string;
  region?: string;
  accessStatus?: string;
  accessNote?: string;
  approachMinutes?: number;
  updated?: string;
  coordinates?: Coordinates;
  map?: MapPosition;
  parking?: ParkingAvailability | string;
  parkingLots?: TopoParkingLot[];
  boulders?: TopoBoulderSeed[];
  [key: string]: unknown;
}

export interface TopoSeed {
  schemaVersion: number;
  version: string;
  areas: TopoAreaSeed[];
}

export interface AreaRow {
  id: string;
  nameJa: string;
  nameEn: string;
  prefecture: string;
  accessStatus: string;
  accessNote: string;
  approachMinutes: number | null;
  updatedAt: string;
  problemCount: number;
  payloadJson: string;
}

export interface BoulderRow {
  id: string;
  areaId: string;
  nameJa: string;
  nameEn: string;
  problemCount: number;
  payloadJson: string;
}

export interface ProblemRow {
  id: string;
  areaId: string;
  boulderId: string;
  areaName: string;
  areaNameJa: string;
  areaNameEn: string;
  boulderName: string;
  boulderNameJa: string;
  boulderNameEn: string;
  nameJa: string;
  nameEn: string;
  grade: string;
  style: string;
  landing: string;
  payloadJson: string;
  boulderPayloadJson: string;
}

export interface SessionRow {
  id: string;
  areaId: string;
  areaName: string;
  areaNameJa: string;
  areaNameEn: string;
  /** Non-empty when the session is for an area outside the bundled topo. */
  customAreaName: string;
  startedAt: string;
  endedAt: string | null;
  energy: number | null;
  weather: number | null;
  mood: number | null;
  skin: number | null;
  conditions: string;
  reflection: string;
  notes: string;
  attemptCount: number;
  sendCount: number;
}

export interface AttemptRow {
  id: string;
  sessionId: string;
  problemId: string;
  problemName: string;
  problemNameJa: string;
  problemNameEn: string;
  grade: string;
  result: AttemptResult;
  tryCount: number;
  perceivedDifficulty: PerceivedDifficulty;
  notes: string;
  occurredAt: string;
}

export interface LogAttemptRow extends AttemptRow {
  areaId: string;
  areaName: string;
  areaNameJa: string;
  areaNameEn: string;
  boulderName: string;
  boulderNameJa: string;
  boulderNameEn: string;
  problemNote: string;
}

export interface StatsRange {
  key: "1m" | "3m" | "1y" | "all";
  label: string;
  since: string | null;
}

export interface StatsSummary {
  totalSends: number;
  totalAttempts: number;
  totalSessions: number;
  sendRate: number;
  averageAttemptsPerSend: number;
  hardestGrade: string;
  gradeSends: Array<{ label: string; value: number }>;
  gradeAttempts: Array<{ label: string; attempts: number; sends: number; averageAttemptsPerSend: number }>;
  areaSends: Array<{ id: string; label: string; value: number }>;
  monthlyTrips: Array<{ label: string; value: number }>;
  progression: Array<{ label: string; grade: string; rank: number }>;
}

export interface AreaStatsSummary {
  areaId: string;
  areaName: string;
  totalSends: number;
  totalAttempts: number;
  totalSessions: number;
  hardestGrade: string;
  gradeSends: Array<{ label: string; value: number }>;
  gradeAttempts: Array<{ label: string; attempts: number; sends: number; averageAttemptsPerSend: number }>;
}

export interface RecapBounds {
  since: string | null;
  until: string | null;
}

export interface RecapTopArea {
  id: string;
  label: string;
  sessionCount: number;
  sendCount: number;
}

export interface RecapHardSend {
  problemId: string;
  problemName: string;
  areaName: string;
  grade: string;
}

export interface RecapSummary {
  totalSends: number;
  flashCount: number;
  uniqueProblemsSent: number;
  totalSessions: number;
  outdoorMinutes: number;
  hardestGrade: string;
  averageGrade: string;
  hardestSend: RecapHardSend | null;
  hardestSends: RecapHardSend[];
  topArea: RecapTopArea | null;
  otherAreas: RecapTopArea[];
  gradeSends: Array<{ label: string; value: number }>;
  periodStart: string | null;
  periodEnd: string | null;
}

export interface ExportBundle {
  format: "opentopo-log";
  schemaVersion: 2;
  exportedAt: string;
  topoVersion: string;
  sessions: Record<string, unknown>[];
  attempts: Record<string, unknown>[];
  problemNotes: Record<string, unknown>[];
}

export type ImportMode = "replace" | "merge";

export type ImportSource = "json" | "csv";

export interface ImportSessionRow {
  id: string;
  area_id: string;
  custom_area_name: string;
  started_at: string;
  ended_at: string | null;
  energy: number | null;
  /** Preferred outdoor-conditions rating. */
  weather: number | null;
  /** Legacy field from older exports; imported as weather when weather is missing. */
  mental: number | null;
  mood: number | null;
  skin: number | null;
  conditions: string;
  reflection: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ImportAttemptRow {
  id: string;
  session_id: string;
  area_id: string;
  boulder_id: string;
  problem_id: string;
  problem_name: string;
  boulder_name: string;
  grade: string;
  occurred_at: string;
  result: AttemptResult;
  try_count: number;
  perceived_difficulty: PerceivedDifficulty;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ImportProblemNoteRow {
  id: string;
  area_id: string;
  problem_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface ImportLogPayload {
  source: ImportSource;
  sessions: ImportSessionRow[];
  attempts: ImportAttemptRow[];
  problemNotes: ImportProblemNoteRow[];
  skipped: number;
}

export interface ImportResult {
  sessions: number;
  attempts: number;
  notes: number;
  skipped: number;
}
