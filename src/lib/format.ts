export function utcDateTime(ms: number): string {
  return `${new Date(ms).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const MILLISECOND_STEPS = 10;

export function durationText(ms: number): string {
  const milliseconds = Math.round(Math.max(0, ms) * MILLISECOND_STEPS) / MILLISECOND_STEPS;
  if (milliseconds < SECOND_MS) return `${milliseconds} ms`;
  if (milliseconds < MINUTE_MS) return `${Math.floor(milliseconds / SECOND_MS)} s`;
  if (milliseconds < HOUR_MS) return `${Math.floor(milliseconds / MINUTE_MS)} min`;
  const hours = Math.floor(milliseconds / HOUR_MS);
  const minutes = Math.floor((milliseconds % HOUR_MS) / MINUTE_MS);
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}
