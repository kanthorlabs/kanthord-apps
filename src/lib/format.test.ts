import { describe, expect, it } from "vitest";

import { durationText, utcDateTime } from "./format";

describe("utcDateTime", () => {
  it("renders a millisecond time as a UTC minute", () => {
    expect(utcDateTime(Date.UTC(2026, 9, 3, 14, 5, 59))).toBe("2026-10-03 14:05 UTC");
  });
});

describe("durationText", () => {
  it("counts seconds, minutes and hours", () => {
    expect(durationText(45_000)).toBe("45 s");
    expect(durationText(20 * 60_000)).toBe("20 min");
    expect(durationText(3_600_000)).toBe("1 h");
    expect(durationText(3_600_000 + 5 * 60_000)).toBe("1 h 5 min");
  });

  it("counts milliseconds under one second", () => {
    expect(durationText(0)).toBe("0 ms");
    expect(durationText(2)).toBe("2 ms");
    expect(durationText(2.5)).toBe("2.5 ms");
    expect(durationText(2.34)).toBe("2.3 ms");
    expect(durationText(999)).toBe("999 ms");
    expect(durationText(999.96)).toBe("1 s");
    expect(durationText(1_000)).toBe("1 s");
  });

  it("answers zero milliseconds for a negative span", () => {
    expect(durationText(-5)).toBe("0 ms");
  });
});
