/** Canonical outdoor topo grades (Japanese dan/kyu). Stored as-is in SQLite. */
export const gradeOrder = [
  "10級",
  "9級",
  "8級",
  "7級",
  "6級",
  "5級",
  "4級",
  "3級",
  "2級",
  "1級",
  "1段",
  "1段+",
  "2段",
  "2段+",
  "3段",
  "4段-",
  "4段",
  "5段"
] as const;

type DankyuGrade = (typeof gradeOrder)[number];
export type GradeSystem = "dankyu" | "vscale";

/** Approximate Hueco V mapping aligned with common Japan outdoor topo charts (e.g. ROCKTOPO). */
const dankyuToVScale: Record<DankyuGrade, string> = {
  "10級": "VB",
  "9級": "VB",
  "8級": "VB",
  "7級": "VB",
  "6級": "V0",
  "5級": "V1",
  "4級": "V2",
  "3級": "V3",
  "2級": "V4",
  "1級": "V6",
  "1段": "V7",
  "1段+": "V8",
  "2段": "V8",
  "2段+": "V9",
  "3段": "V11",
  "4段-": "V12",
  "4段": "V12",
  "5段": "V14"
};

const vScaleToDankyu = new Map<string, string[]>();
for (const grade of gradeOrder) {
  const vScale = dankyuToVScale[grade];
  const list = vScaleToDankyu.get(vScale) ?? [];
  list.push(grade);
  vScaleToDankyu.set(vScale, list);
}

export function gradeRank(grade: string): number {
  const rank = gradeOrder.indexOf(grade as DankyuGrade);
  return rank < 0 ? -1 : rank;
}

/** Send-weighted mean grade, rounded to the nearest dankyu step. */
export function averageGrade(grades: Iterable<string>): string {
  let sum = 0;
  let count = 0;
  for (const grade of grades) {
    const rank = gradeRank(grade);
    if (rank < 0) continue;
    sum += rank;
    count += 1;
  }
  if (count === 0) return "—";
  const nearest = Math.min(gradeOrder.length - 1, Math.max(0, Math.round(sum / count)));
  return gradeOrder[nearest] ?? "—";
}

export function formatGrade(grade: string, system: GradeSystem): string {
  if (!grade || system === "dankyu") return grade;
  return dankyuToVScale[grade as DankyuGrade] ?? grade;
}

function normalizeVScaleQuery(query: string): string | null {
  const trimmed = query.trim();
  if (/^vb$/i.test(trimmed)) return "VB";
  const match = trimmed.match(/^v\s*(\d+)$/i);
  return match ? `V${match[1]}` : null;
}

/** Stored dan/kyu grades that should match a search query (plus the raw query via caller). */
export function dankyuGradesMatchingQuery(query: string): string[] {
  const vScale = normalizeVScaleQuery(query);
  if (!vScale) return [];
  return vScaleToDankyu.get(vScale) ?? [];
}

/** Collapse bars that share a display label (e.g. several kyu grades → VB). */
export function remapGradeBars<T extends { label: string; value: number }>(
  items: T[],
  system: GradeSystem
): T[] {
  if (system === "dankyu") return items;
  const order: string[] = [];
  const merged = new Map<string, T>();
  for (const item of items) {
    const label = formatGrade(item.label, system);
    const existing = merged.get(label);
    if (!existing) {
      order.push(label);
      merged.set(label, { ...item, label });
      continue;
    }
    merged.set(label, { ...existing, value: existing.value + item.value });
  }
  return order.map((label) => merged.get(label)!);
}

export function remapGradeAttempts<
  T extends { label: string; attempts: number; sends: number; averageAttemptsPerSend: number }
>(items: T[], system: GradeSystem): T[] {
  if (system === "dankyu") return items;
  const order: string[] = [];
  const merged = new Map<string, { attempts: number; sends: number }>();
  for (const item of items) {
    const label = formatGrade(item.label, system);
    if (!merged.has(label)) order.push(label);
    const current = merged.get(label) ?? { attempts: 0, sends: 0 };
    merged.set(label, {
      attempts: current.attempts + item.attempts,
      sends: current.sends + item.sends
    });
  }
  return order.map((label) => {
    const { attempts, sends } = merged.get(label)!;
    return {
      label,
      attempts,
      sends,
      averageAttemptsPerSend: Number((attempts / Math.max(1, sends)).toFixed(1))
    } as T;
  });
}
