import type { FlowQuery } from "@/api/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const PERCENT = 100;
const MINUS = "−";
const NO_DELTA = "—";

const GROUPED = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function wholeOrTenth(value: number): string {
  const tenths = Math.round(value * 10) / 10;
  return value >= 10 || tenths >= 10 ? String(Math.round(value)) : tenths.toFixed(1);
}

function signOf(value: number): string {
  return value < 0 ? MINUS : "+";
}

export function countText(value: number): string {
  return GROUPED.format(value);
}

export function rateText(ratio: number): string {
  return `${(ratio * PERCENT).toFixed(1)} %`;
}

export function rateBoundText(ratio: number): string {
  return rateText(ratio).replace(".0 %", " %");
}

export function durationText(ms: number): string {
  const value = Math.max(0, ms);
  if (value >= HOUR_MS) return `${wholeOrTenth(value / HOUR_MS)} h`;
  if (value >= MINUTE_MS) {
    const minutes = Math.round(value / MINUTE_MS);
    return minutes < 60 ? `${minutes} min` : durationText(HOUR_MS);
  }
  if (value >= SECOND_MS) {
    const seconds = Math.round(value / SECOND_MS);
    return seconds < 60 ? `${seconds} s` : durationText(MINUTE_MS);
  }
  const milliseconds = Math.round(value);
  return milliseconds < SECOND_MS ? `${milliseconds} ms` : durationText(SECOND_MS);
}

export function durationBoundText(ms: number): string {
  return ms >= HOUR_MS && ms % HOUR_MS === 0 ? `${ms / HOUR_MS} h` : durationText(ms);
}

export function costText(usd: number): string {
  const cents = Math.round(usd * PERCENT) / PERCENT;
  return cents >= PERCENT ? `$${GROUPED.format(cents)}` : `$${cents.toFixed(2)}`;
}

export function costChangeText(current: number, previous: number): string {
  const whole = Math.round(current - previous);
  return whole === 0 ? "$0" : `${signOf(whole)}$${GROUPED.format(Math.abs(whole))}`;
}

export function tokensText(tokens: number): string {
  if (tokens >= 1e9) return `${(tokens / 1e9).toFixed(1)} B`;
  if (tokens >= 1e8) return `${Math.round(tokens / 1e6)} M`;
  if (tokens >= 1e7) return `${(tokens / 1e6).toFixed(1)} M`;
  if (tokens >= 1e6) return `${Number((tokens / 1e6).toFixed(2))} M`;
  if (tokens >= 1e3) return `${(tokens / 1e3).toFixed(1)} k`;
  return countText(tokens);
}

export function ratioText(ratio: number): string {
  return ratio.toFixed(2);
}

export function rateDeltaText(current: number, previous: number | null): string {
  if (previous === null) return NO_DELTA;
  const points = Math.round((current - previous) * PERCENT * 10) / 10;
  return `${signOf(points)}${Math.abs(points).toFixed(1)} pp`;
}

export function deltaText(current: number, previous: number | null): string {
  if (previous === null || previous === 0) return NO_DELTA;
  const percent = ((current - previous) / previous) * PERCENT;
  return `${signOf(percent)}${wholeOrTenth(Math.abs(percent))} %`;
}

function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

export function dayLabel(ms: number): string {
  const date = new Date(ms);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

export function timeLabel(ms: number): string {
  const date = new Date(ms);
  return `${twoDigits(date.getUTCHours())}:${twoDigits(date.getUTCMinutes())}`;
}

export function hourLabel(ms: number): string {
  return `${dayLabel(ms)} ${timeLabel(ms)}`;
}

export function bucketLabel(ms: number, bucket: FlowQuery["bucket"]): string {
  return bucket === "hour" ? hourLabel(ms) : dayLabel(ms);
}

export function runLabel(indexes: readonly number[], labels: readonly string[]): string {
  const runs: { first: number; last: number }[] = [];
  for (const index of [...indexes].sort((a, b) => a - b)) {
    const run = runs.at(-1);
    if (run !== undefined && run.last === index - 1) run.last = index;
    else runs.push({ first: index, last: index });
  }
  return runs
    .map(({ first, last }) => {
      const start = labels[first] ?? "";
      return first === last ? start : `${start} – ${labels[last] ?? ""}`;
    })
    .join(", ");
}
