export interface SnoozeChoice {
  readonly id: "three_hours" | "tomorrow" | "monday";
  readonly label: string;
  readonly until: number;
}

const MORNING_HOUR = 8;
const THREE_HOURS_MS = 3 * 60 * 60_000;
const MONDAY = 1;
const DAYS_PER_WEEK = 7;

function morningOf(from: Date, days: number): number {
  return new Date(
    from.getFullYear(),
    from.getMonth(),
    from.getDate() + days,
    MORNING_HOUR,
  ).getTime();
}

export function snoozeChoicesOf(now: number): readonly SnoozeChoice[] {
  const from = new Date(now);
  const untilMonday = (MONDAY - from.getDay() + DAYS_PER_WEEK) % DAYS_PER_WEEK || DAYS_PER_WEEK;
  return [
    { id: "three_hours", label: "In 3 hours", until: now + THREE_HOURS_MS },
    { id: "tomorrow", label: "Tomorrow 08:00", until: morningOf(from, 1) },
    { id: "monday", label: "Monday 08:00", until: morningOf(from, untilMonday) },
  ];
}
