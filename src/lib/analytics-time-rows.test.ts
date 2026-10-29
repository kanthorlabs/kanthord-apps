import { describe, expect, it } from "vitest";

import type { AnalyticsDurationItem, AnalyticsFloorShareItem } from "@/api/types";

import { floorShareRowsOf, timeRowsOf } from "./analytics-time-rows";

const DAY_START = Date.UTC(2026, 4, 4);

function item(overrides: Partial<AnalyticsDurationItem> = {}): AnalyticsDurationItem {
  return {
    key: "read_file",
    bucket_start: null,
    count: 4,
    p50: 1000,
    p90: 2000,
    p99: 3000,
    mean: 1500,
    max: 4000,
    ...overrides,
  };
}

describe("timeRowsOf", () => {
  it("shows a duration through durationText and marks the percentiles on the largest max", () => {
    const rows = timeRowsOf(
      [item(), item({ key: "edit_file", max: 8000 })],
      "tool_latency",
      "day",
      "tool_name",
      new Map(),
    );

    expect(rows[0]?.fields).toEqual([
      { label: "Count", value: "4" },
      { label: "p50", value: "1 s" },
      { label: "p90", value: "2 s" },
      { label: "p99", value: "3 s" },
      { label: "Max", value: "4 s" },
    ]);
    expect(rows[0]).toMatchObject({ max: 4000, scale: 8000 });
    expect(rows[0]?.marks).toEqual([
      { label: "p50", percent: 12.5 },
      { label: "p90", percent: 25 },
      { label: "p99", percent: 37.5 },
    ]);
    expect(rows[1]?.barLabel).toBe("Time of edit_file: p50 1 s, p90 2 s, p99 3 s, max 8 s");
  });

  it("shows revision turns as counts", () => {
    const [row] = timeRowsOf(
      [item({ p50: 1, p90: 2, p99: 3, max: 3 })],
      "revision_turns",
      "day",
      "none",
      new Map(),
    );

    expect(row?.fields.map((field) => field.value)).toEqual(["4", "1", "2", "3", "3"]);
    expect(row?.barLabel).toBe("Time of All: p50 1, p90 2, p99 3, max 3");
  });

  it("names a row of no group All, a null key Unknown and a key by its record name", () => {
    const names = new Map([["node_1", "Audit log"]]);

    expect(timeRowsOf([item({ key: null })], "span_duration", "day", "none", names)[0]?.title).toBe(
      "All",
    );
    expect(
      timeRowsOf([item({ key: null })], "span_duration", "day", "node_id", names)[0]?.title,
    ).toBe("Unknown");
    expect(
      timeRowsOf([item({ key: "node_1" })], "span_duration", "day", "node_id", names)[0]?.title,
    ).toBe("Audit log");
  });

  it("shows the bucket of a row and keys a row by its bucket and key", () => {
    const rows = timeRowsOf(
      [item({ bucket_start: DAY_START }), item({ bucket_start: DAY_START + 86_400_000 })],
      "span_duration",
      "day",
      "tool_name",
      new Map(),
    );

    expect(rows.map((row) => row.bucketText)).toEqual(["2026-05-04", "2026-05-05"]);
    expect(new Set(rows.map((row) => row.key)).size).toBe(2);
    expect(rows[0]?.barLabel).toContain("Time of read_file 2026-05-04:");
  });

  it.each(["queue_wait", "review_wait"] as const)(
    "shows a wait of %s under one second in milliseconds",
    (measure) => {
      const [row] = timeRowsOf(
        [item({ p50: 2, p90: 2.5, p99: 4, max: 4 })],
        measure,
        "day",
        "none",
        new Map(),
      );

      expect(row?.barLabel).toContain("p50 2 ms, p90 2.5 ms, p99 4 ms, max 4 ms");
    },
  );

  it("keeps the scale above zero when every max is zero", () => {
    const [row] = timeRowsOf(
      [item({ p50: 0, p90: 0, p99: 0, max: 0 })],
      "span_duration",
      "day",
      "none",
      new Map(),
    );

    expect(row?.scale).toBe(1);
    expect(row?.marks.map((mark) => mark.percent)).toEqual([0, 0, 0]);
  });

  it("links a node_id or model row to the filtered trace list and no other row", () => {
    const path = (group: "node_id" | "model" | "tool_name" | "none", key: string | null) =>
      timeRowsOf([item({ key })], "span_duration", "day", group, new Map())[0]?.tracesPath;

    expect(path("node_id", "node_1")).toBe("/traces?node_id=node_1");
    expect(path("model", "a/b")).toBe("/traces?model=a%2Fb");
    expect(path("node_id", null)).toBeNull();
    expect(path("tool_name", "read_file")).toBeNull();
    expect(path("none", null)).toBeNull();
  });
});

describe("floorShareRowsOf", () => {
  it("a floor share row holds the count and the percent", () => {
    const share: AnalyticsFloorShareItem = {
      key: "node_1",
      bucket_start: DAY_START,
      count: 3,
      share: 0.25,
    };
    const [row] = floorShareRowsOf([share], "day", "node_id", new Map());

    expect(row?.fields).toEqual([
      { label: "Count", value: "3" },
      { label: "Share", value: "25%" },
    ]);
    expect(row?.share).toBe(0.25);
    expect(row?.barLabel).toBe("Test floor share of node_1 2026-05-04: count 3, share 25%");
    expect(row?.tracesPath).toBe("/traces?node_id=node_1");
  });

  it.each([
    [0, "0%"],
    [1, "100%"],
  ])("a floor share of %s shows %s and the bar value", (value, text) => {
    const share: AnalyticsFloorShareItem = {
      key: "node_1",
      bucket_start: DAY_START,
      count: 2,
      share: value,
    };
    const [row] = floorShareRowsOf([share], "day", "node_id", new Map());

    expect(row?.fields).toEqual([
      { label: "Count", value: "2" },
      { label: "Share", value: text },
    ]);
    expect(row?.share).toBe(value);
    expect(row?.barLabel).toBe(`Test floor share of node_1 2026-05-04: count 2, share ${text}`);
  });
});
