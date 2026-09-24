import { describe, expect, it } from "vitest";

import { duration, percent, relativeTime } from "./format";

const base = Date.parse("2026-09-18T12:00:00.000Z");
const iso = (secondsAgo: number) => new Date(base - secondsAgo * 1000).toISOString();

describe("relativeTime", () => {
  it("reads a past moment in the coarsest fitting unit", () => {
    expect(relativeTime(iso(45), base)).toBe("45s ago");
    expect(relativeTime(iso(600), base)).toBe("10m ago");
    expect(relativeTime(iso(7200), base)).toBe("2h ago");
    expect(relativeTime(iso(172_800), base)).toBe("2d ago");
  });

  it("reads a future moment ahead, which a lease expiry needs", () => {
    expect(relativeTime(iso(-90), base)).toBe("in 2m");
  });
});

describe("duration", () => {
  it("drops the hour when there is none", () => {
    expect(duration(600)).toBe("10m");
    expect(duration(7200)).toBe("2h 0m");
    expect(duration(5400)).toBe("1h 30m");
  });
});

describe("percent", () => {
  it("caps an over-budget proportion so a bar never overflows", () => {
    expect(percent(100, 200)).toBe(50);
    expect(percent(8400, 7200)).toBe(100);
  });

  it("reads zero against no budget", () => {
    expect(percent(5, 0)).toBe(0);
  });
});
