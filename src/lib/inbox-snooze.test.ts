import { describe, expect, it } from "vitest";

import { snoozeChoicesOf } from "./inbox-snooze";

function choiceOf(now: Date, id: string): number {
  const choice = snoozeChoicesOf(now.getTime()).find((entry) => entry.id === id);
  if (choice === undefined) throw new Error(`No choice ${id}.`);
  return choice.until;
}

describe("snoozeChoicesOf", () => {
  it("names the three choices", () => {
    expect(snoozeChoicesOf(Date.now()).map((choice) => choice.label)).toEqual([
      "In 3 hours",
      "Tomorrow 08:00",
      "Monday 08:00",
    ]);
  });

  it("adds three hours to now", () => {
    const now = new Date(2026, 2, 4, 10, 30);

    expect(choiceOf(now, "three_hours")).toBe(new Date(2026, 2, 4, 13, 30).getTime());
  });

  it("answers 08:00 of the next day in local time", () => {
    const now = new Date(2026, 2, 4, 23, 59);

    expect(choiceOf(now, "tomorrow")).toBe(new Date(2026, 2, 5, 8, 0).getTime());
  });

  it("answers 08:00 of the next Monday in local time", () => {
    const wednesday = new Date(2026, 2, 4, 10, 0);
    const monday = new Date(2026, 2, 9, 10, 0);

    expect(choiceOf(wednesday, "monday")).toBe(new Date(2026, 2, 9, 8, 0).getTime());
    expect(choiceOf(monday, "monday")).toBe(new Date(2026, 2, 16, 8, 0).getTime());
  });
});
