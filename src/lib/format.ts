export function utcDateTime(ms: number): string {
  return `${new Date(ms).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;

export function durationText(ms: number): string {
  if (ms < MINUTE_MS) return `${Math.max(0, Math.floor(ms / SECOND_MS))} s`;
  if (ms < HOUR_MS) return `${Math.floor(ms / MINUTE_MS)} min`;
  const hours = Math.floor(ms / HOUR_MS);
  const minutes = Math.floor((ms % HOUR_MS) / MINUTE_MS);
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}
