const ISO_DATE = /^(\d{4}-\d{2}-\d{2})/;

export function datePrefix(value: string): string | null {
  return ISO_DATE.exec(value)?.[1] ?? null;
}

/** Newest YYYY-MM-DD among area/commit timestamps; used as the user-facing topo version. */
export function latestTopoVersion(
  candidates: (string | undefined | null)[],
  fallback: string
): string {
  const dates = candidates
    .map((value) => (value ? datePrefix(value) : null))
    .filter((value): value is string => value !== null)
    .sort();
  return dates.at(-1) ?? datePrefix(fallback) ?? fallback;
}

export function formatTopoVersionLabel(version: string): string {
  const date = datePrefix(version);
  if (date) return date;
  if (/^[0-9a-f]{9,40}$/i.test(version)) return version.slice(0, 8);
  return version;
}
