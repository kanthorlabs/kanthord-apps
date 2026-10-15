const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const STALE_AFTER_MS = MINUTE_MS;

function counted(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? "" : "s"} ago`;
}

export function relativeAge(at: number, now: number): string {
  const elapsed = now - at;
  if (elapsed < MINUTE_MS) return "just now";
  if (elapsed < HOUR_MS) return counted(Math.floor(elapsed / MINUTE_MS), "minute");
  if (elapsed < DAY_MS) return counted(Math.floor(elapsed / HOUR_MS), "hour");
  return counted(Math.floor(elapsed / DAY_MS), "day");
}

export function isStale(at: number, now: number): boolean {
  return now - at > STALE_AFTER_MS;
}
