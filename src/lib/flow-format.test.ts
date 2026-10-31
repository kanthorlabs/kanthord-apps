import { describe, expect, it } from "vitest";

import {
  bucketLabel,
  costChangeText,
  costText,
  countText,
  dayLabel,
  deltaText,
  durationBoundText,
  durationText,
  hourLabel,
  rateBoundText,
  rateDeltaText,
  rateText,
  ratioText,
  runLabel,
  timeLabel,
  tokensText,
} from "./flow-format";

const HOUR = 3_600_000;
const MINUTE = 60_000;

describe("counts and rates", () => {
  it("groups the digits of a count", () => {
    expect(countText(1412)).toBe("1,412");
    expect(countText(9)).toBe("9");
  });

  it("writes a rate with one decimal", () => {
    expect(rateText(0.22)).toBe("22.0 %");
    expect(rateText(0.05)).toBe("5.0 %");
  });

  it("drops the decimal of a bound", () => {
    expect(rateBoundText(0.15)).toBe("15 %");
    expect(rateBoundText(0.4)).toBe("40 %");
    expect(rateBoundText(0.075)).toBe("7.5 %");
  });

  it("writes a ratio with two decimals", () => {
    expect(ratioText(0.81)).toBe("0.81");
  });
});

describe("durationText", () => {
  it("writes whole hours from 10 h", () => {
    expect(durationText(31 * HOUR)).toBe("31 h");
  });

  it("writes one decimal from 1 h", () => {
    expect(durationText(2.7 * HOUR)).toBe("2.7 h");
    expect(durationText(HOUR)).toBe("1.0 h");
  });

  it("writes whole minutes from 1 min", () => {
    expect(durationText(10 * MINUTE)).toBe("10 min");
    expect(durationText(MINUTE)).toBe("1 min");
  });

  it("writes whole seconds from 1 s", () => {
    expect(durationText(45_000)).toBe("45 s");
  });

  it("writes milliseconds below 1 s", () => {
    expect(durationText(250)).toBe("250 ms");
  });

  it("moves to the next unit when the rounding reaches it", () => {
    expect(durationText(59_700)).toBe("1 min");
    expect(durationText(59.6 * MINUTE)).toBe("1.0 h");
    expect(durationText(999.7)).toBe("1 s");
    expect(durationText(9.97 * HOUR)).toBe("10 h");
  });

  it("writes a bound of whole hours without a decimal", () => {
    expect(durationBoundText(HOUR)).toBe("1 h");
    expect(durationBoundText(4 * HOUR)).toBe("4 h");
    expect(durationBoundText(15 * MINUTE)).toBe("15 min");
  });
});

describe("costs", () => {
  it("writes whole dollars from $100", () => {
    expect(costText(412.8)).toBe("$413");
    expect(costText(1234.4)).toBe("$1,234");
  });

  it("writes two decimals below $100", () => {
    expect(costText(22.5)).toBe("$22.50");
    expect(costText(99.996)).toBe("$100");
  });

  it("writes a signed change in whole dollars", () => {
    expect(costChangeText(412.8, 349.6)).toBe("+$63");
    expect(costChangeText(100, 112)).toBe("−$12");
    expect(costChangeText(100, 100.2)).toBe("$0");
  });
});

describe("tokensText", () => {
  it("writes billions with one decimal", () => {
    expect(tokensText(1.2e9)).toBe("1.2 B");
  });

  it("writes whole millions from 1e8", () => {
    expect(tokensText(655e6)).toBe("655 M");
  });

  it("writes one decimal from 1e7", () => {
    expect(tokensText(61.9e6)).toBe("61.9 M");
  });

  it("writes at most two decimals from 1e6 and drops trailing zeros", () => {
    expect(tokensText(4.95e6)).toBe("4.95 M");
    expect(tokensText(9.5e6)).toBe("9.5 M");
    expect(tokensText(5e6)).toBe("5 M");
  });

  it("writes thousands with one decimal", () => {
    expect(tokensText(12_400)).toBe("12.4 k");
  });

  it("writes a small count as it is", () => {
    expect(tokensText(412)).toBe("412");
  });
});

describe("deltas", () => {
  it("writes a rate delta in points", () => {
    expect(rateDeltaText(0.274, 0.25)).toBe("+2.4 pp");
    expect(rateDeltaText(0.2, 0.235)).toBe("−3.5 pp");
  });

  it("writes a whole percent from 10 %", () => {
    expect(deltaText(118, 100)).toBe("+18 %");
    expect(deltaText(80, 100)).toBe("−20 %");
  });

  it("writes one decimal below 10 %", () => {
    expect(deltaText(109.9, 100)).toBe("+9.9 %");
    expect(deltaText(95, 100)).toBe("−5.0 %");
  });

  it("writes a dash with no previous value or a previous value of 0", () => {
    expect(deltaText(5, null)).toBe("—");
    expect(deltaText(5, 0)).toBe("—");
    expect(rateDeltaText(0.2, null)).toBe("—");
  });
});

describe("labels", () => {
  const OCT_27 = Date.UTC(2026, 9, 27);
  const NOW = Date.UTC(2026, 9, 30, 14, 12);

  it("writes a day label", () => {
    expect(dayLabel(OCT_27)).toBe("Oct 27");
  });

  it("writes an hour label and a time", () => {
    expect(hourLabel(Date.UTC(2026, 9, 30, 14))).toBe("Oct 30 14:00");
    expect(timeLabel(NOW)).toBe("14:12");
  });

  it("writes the label of a bucket by its grain", () => {
    expect(bucketLabel(NOW, "day")).toBe("Oct 30");
    expect(bucketLabel(NOW, "hour")).toBe("Oct 30 14:12");
  });

  it("writes runs of bucket indexes", () => {
    const labels = ["Oct 24", "Oct 25", "Oct 26", "Oct 27", "Oct 28"];
    expect(runLabel([1, 3, 4], labels)).toBe("Oct 25, Oct 27 – Oct 28");
    expect(runLabel([0, 1, 2], labels)).toBe("Oct 24 – Oct 26");
    expect(runLabel([], labels)).toBe("");
  });
});
