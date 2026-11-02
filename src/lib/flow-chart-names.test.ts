import { describe, expect, it } from "vitest";

import { dayBarsNameOf, sparklineNameOf } from "./flow-chart-names";

const plain = (value: number) => String(value);

describe("dayBarsNameOf", () => {
  it("names the range of the daily cost", () => {
    expect(dayBarsNameOf([10, 20, 40], "qwen3-coder")).toBe(
      "Daily cost of qwen3-coder from $10.00 to $40.00",
    );
  });

  it("names an empty series", () => {
    expect(dayBarsNameOf([], "idle")).toBe("Daily cost of idle has no values");
  });
});

describe("sparklineNameOf", () => {
  it("names the line with the range and both bounds", () => {
    expect(
      sparklineNameOf(
        "leak rate",
        [0.09, 0.43],
        [
          ["warn", 0.15],
          ["bad", 0.25],
        ],
        plain,
      ),
    ).toBe("Daily leak rate from 0.09 to 0.43, warn line 0.15, bad line 0.25");
  });

  it("names the line with no bound line", () => {
    expect(sparklineNameOf("leak rate", [0.09, 0.43], [], plain)).toBe(
      "Daily leak rate from 0.09 to 0.43",
    );
  });

  it("formats the numbers of the name with the given format", () => {
    expect(
      sparklineNameOf("wait p90", [60_000, 120_000], [], (value) => `${value / 60_000} min`),
    ).toBe("Daily wait p90 from 1 min to 2 min");
  });

  it("names an empty series", () => {
    expect(sparklineNameOf("leak rate", [], [], plain)).toBe("Daily leak rate has no values");
  });
});
