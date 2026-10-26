import { describe, expect, it } from "vitest";

import { slowToolText } from "./trace-now";

describe("slowToolText", () => {
  it("answers the text when the age exceeds the p90", () => {
    expect(slowToolText(61_000, 60_000)).toBe(
      "Longer than 90% of the runs of this tool in 7 days (p90 1 min).",
    );
  });

  it("answers null when the age equals or is below the p90", () => {
    expect(slowToolText(60_000, 60_000)).toBeNull();
    expect(slowToolText(1000, 60_000)).toBeNull();
  });

  it("answers null when the p90 is unknown", () => {
    expect(slowToolText(61_000, null)).toBeNull();
  });
});
