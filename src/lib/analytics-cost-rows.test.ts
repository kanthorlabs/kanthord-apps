import { describe, expect, it } from "vitest";

import type { AnalyticsCostItem } from "@/api/types";

import { costFieldsOf, costKeyLabel, costRowsOf } from "./analytics-cost-rows";

const DAY_START = Date.UTC(2026, 4, 4);

function item(overrides: Partial<AnalyticsCostItem> = {}): AnalyticsCostItem {
  return {
    key: "gpt-5",
    bucket_start: DAY_START,
    turn_count: 3,
    input_tokens: 1500,
    output_tokens: 250,
    cache_read_tokens: 700,
    cache_creation_tokens: 350,
    total_tokens: 1750,
    cost_usd: 0.0125,
    ...overrides,
  };
}

describe("costKeyLabel", () => {
  it("names a null key Unknown", () => {
    expect(costKeyLabel(null, new Map())).toBe("Unknown");
  });

  it("names a key by its record name and falls back to the key", () => {
    const names = new Map([["node_1", "Audit log"]]);

    expect(costKeyLabel("node_1", names)).toBe("Audit log");
    expect(costKeyLabel("node_2", names)).toBe("node_2");
  });
});

describe("costFieldsOf", () => {
  it("shows the turns, the tokens and Est. cost", () => {
    expect(costFieldsOf(item())).toEqual([
      { label: "Turns", value: "3" },
      { label: "Input", value: "1.5k" },
      { label: "Output", value: "250" },
      { label: "Cached", value: "1.1k" },
      { label: "Est. cost", value: "$0.0125" },
    ]);
  });
});

describe("costRowsOf", () => {
  it("keeps the order of the items and sets the largest cost as the maximum of every bar", () => {
    const rows = costRowsOf(
      [item({ key: "a", cost_usd: 0.01 }), item({ key: "b", cost_usd: 0.04 })],
      "day",
      new Map(),
    );

    expect(rows.map((row) => [row.title, row.cost, row.maxCost])).toEqual([
      ["a", 0.01, 0.04],
      ["b", 0.04, 0.04],
    ]);
  });

  it("keeps a positive maximum when every cost is zero", () => {
    const rows = costRowsOf([item({ cost_usd: 0 })], "day", new Map());

    expect(rows[0]?.maxCost).toBeGreaterThan(0);
  });

  it("names the bucket by its size in UTC", () => {
    const text = (bucket: "hour" | "day" | "week") =>
      costRowsOf([item({ bucket_start: DAY_START + 3 * 3_600_000 })], bucket, new Map())[0]
        ?.bucketText;

    expect(text("hour")).toBe("2026-05-04 03:00 UTC");
    expect(text("day")).toBe("2026-05-04");
    expect(text("week")).toBe("Week of 2026-05-04");
  });

  it("gives a unique key to each group of each bucket", () => {
    const rows = costRowsOf(
      [
        item({ key: "a" }),
        item({ key: null }),
        item({ key: "a", bucket_start: DAY_START + 86_400_000 }),
      ],
      "day",
      new Map(),
    );

    expect(new Set(rows.map((row) => row.key)).size).toBe(3);
    expect(rows[1]?.title).toBe("Unknown");
  });
});
