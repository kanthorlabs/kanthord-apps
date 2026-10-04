import { describe, expect, it } from "vitest";

import { utcDateTime } from "./format";

describe("utcDateTime", () => {
  it("renders a millisecond time as a UTC minute", () => {
    expect(utcDateTime(Date.UTC(2026, 9, 3, 14, 5, 59))).toBe("2026-10-03 14:05 UTC");
  });
});
