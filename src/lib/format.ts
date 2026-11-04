export function utcDateTime(ms: number): string {
  return `${new Date(ms).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export function utcShortDateTime(ms: number): string {
  return new Date(ms).toISOString().slice(5, 16).replace("T", " ");
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

const BYTE_STEP = 1_024;

function oneDecimal(value: number): string {
  return value.toFixed(1).replace(/\.0$/, "");
}

export function byteText(bytes: number): string {
  const kibibytes = bytes / BYTE_STEP;
  if (Number(kibibytes.toFixed(1)) < BYTE_STEP) return `${oneDecimal(kibibytes)} KiB`;
  return `${oneDecimal(kibibytes / BYTE_STEP)} MiB`;
}
