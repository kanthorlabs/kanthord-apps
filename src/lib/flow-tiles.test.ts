import { describe, expect, it } from "vitest";

import type { FlowRead, FlowUsageRow } from "@/api/types";

import flowRead from "../../test/flow-read.json";
import { frameOf } from "./flow-status";
import { scorecardOf, type ScorecardTile, tileSignalsOf } from "./flow-tiles";

const FLOW_READ = flowRead as unknown as FlowRead;
const FRAME = frameOf(FLOW_READ, "7d");
const WINDOW_FROM = 1792800000000;
const NOW = 1793369520000;
const DAY_MS = 86_400_000;

function tilesOf(read: FlowRead = FLOW_READ): readonly ScorecardTile[] {
  return scorecardOf(read, frameOf(read, "7d")).rows.flatMap((row) => row.tiles);
}

function tileOf(label: string, read: FlowRead = FLOW_READ): ScorecardTile {
  const tile = tilesOf(read).find((candidate) => candidate.label === label);
  if (tile === undefined) throw new Error(`No tile ${label}`);
  return tile;
}

function withoutSameHour(): FlowRead {
  return {
    ...FLOW_READ,
    cost: { ...FLOW_READ.cost, previous_same_hour: null },
    usage: { ...FLOW_READ.usage, previous_same_hour: null },
  };
}

function withModels(models: readonly FlowUsageRow[]): FlowRead {
  return {
    ...FLOW_READ,
    usage: { ...FLOW_READ.usage, by: { ...FLOW_READ.usage.by, model: models } },
  };
}

function modelRow(key: string): FlowUsageRow {
  const row = FLOW_READ.usage.by.model.find((candidate) => candidate.key === key);
  if (row === undefined) throw new Error(`No model ${key}`);
  return row;
}

describe("scorecardOf", () => {
  it("lists the eight tiles in two rows", () => {
    const { rows } = scorecardOf(FLOW_READ, FRAME);

    expect(rows.map((row) => [row.name, row.tiles.map((tile) => tile.label)])).toEqual([
      ["Cost", ["Total cost", "Cost per success", "Leaked cost share", "Rejected review cost"]],
      ["Tokens", ["Total tokens", "Tokens per success", "Cache hit ratio", "Unpriced tokens"]],
    ]);
  });

  it("reads the value and the delta of each tile", () => {
    expect(tilesOf().map((tile) => `${tile.value} ${tile.delta}`)).toEqual([
      "$413 +18 %",
      "$2.26 +9.9 %",
      "10.9 % +2.4 pp",
      "$22.50 +52 %",
      "655 M +13 %",
      "3.58 M +5.2 %",
      "68.5 % −3.5 pp",
      "9.5 % +0.7 pp",
    ]);
  });

  it("reads the line of each tile", () => {
    expect(tilesOf().map((tile) => tile.line)).toEqual([
      "+$63 = volume +$27 · unit cost +$36",
      "ended · Oct 27 $3.01 > $2.57",
      "ended · Oct 27 23.6 % > 20 %",
      "74 rework · 9 blocked",
      "cache 442 M · fresh 203 M · out 9.5 M",
      "ended · Oct 27 4.95 M > 4.25 M",
      "gpt-5-codex 32.0 % Oct 29 < 40 % · since Oct 28",
      "claude-code@1 · not in cost",
    ]);
  });

  it("marks the tile kinds and keeps the status accent for an active tile", () => {
    expect(tilesOf().map((tile) => [tile.kind, tile.icon, tile.severity])).toEqual([
      ["context", "ok", "ok"],
      ["status", "ok", "ok"],
      ["status", "ok", "ok"],
      ["context", "ok", "ok"],
      ["context", "ok", "ok"],
      ["status", "ok", "ok"],
      ["status", "bad", "bad"],
      ["context", "ok", "ok"],
    ]);
  });

  it("draws the bounds of a status tile and none for a context tile", () => {
    expect(tileOf("Cost per success").bounds?.warn).toBeCloseTo(2.5668, 3);
    expect(tileOf("Cache hit ratio").bounds).toMatchObject({
      direction: "low",
      warn: 0.6,
      bad: 0.4,
    });
    expect(tileOf("Total cost").bounds).toBeNull();
  });

  it("adds the slice series to the tile of a slice result", () => {
    expect(tileOf("Cache hit ratio").slice).toEqual({
      key: "gpt-5-codex",
      values: [0.71, 0.7, 0.72, 0.71, 0.34, 0.32, 0.31],
      severity: "bad",
    });
    expect(tileOf("Cost per success").slice).toBeNull();
  });

  it("opens the tile target with the window span", () => {
    expect(tileOf("Total cost").target).toBe(`/traces?sort=cost_usd&from=${WINDOW_FROM}&to=${NOW}`);
  });

  it("opens an ongoing tile from its since bucket with its slice", () => {
    const from = WINDOW_FROM + 4 * DAY_MS;
    expect(tileOf("Cache hit ratio").target).toBe(
      `/traces?model=gpt-5-codex&sort=total_tokens&from=${from}&to=${NOW}`,
    );
  });

  it("compares a status tile with the full previous window", () => {
    expect(tileOf("Cost per success").delta).toBe("+9.9 %");
    expect(tileOf("Leaked cost share").delta).toBe("+2.4 pp");
  });

  it("compares a context tile with the same-hour sums", () => {
    expect(tileOf("Total cost").delta).toBe("+18 %");
    expect(tileOf("Unpriced tokens").delta).toBe("+0.7 pp");
  });

  it("shows no delta on a context tile with null same-hour sums", () => {
    const contexts = tilesOf(withoutSameHour()).filter((tile) => tile.kind === "context");

    expect(contexts.map((tile) => tile.delta)).toEqual([null, null, null, null]);
    expect(tileOf("Total cost", withoutSameHour()).line).toBeNull();
  });

  it("keeps the delta of a status tile with null same-hour sums", () => {
    expect(tileOf("Cost per success", withoutSameHour()).delta).toBe("+9.9 %");
  });

  it("reads a null per-success value as a dash when fewer than ten succeed", () => {
    const read: FlowRead = {
      ...FLOW_READ,
      cost: { ...FLOW_READ.cost, current: { ...FLOW_READ.cost.current, success: 9 } },
    };

    expect(tileOf("Cost per success", read)).toMatchObject({ value: "—", delta: null });
    expect(tileOf("Tokens per success", read).value).toBe("—");
  });

  it("reads a null ratio as a dash without a positive denominator", () => {
    const read: FlowRead = {
      ...FLOW_READ,
      usage: {
        ...FLOW_READ.usage,
        current: { ...FLOW_READ.usage.current, input_tokens: 0, output_tokens: 0 },
      },
    };

    expect(tileOf("Cache hit ratio", read).value).toBe("—");
    expect(tileOf("Unpriced tokens", read).value).toBe("—");
  });

  it("reads ok status tiles as within the warn bound", () => {
    const read: FlowRead = {
      ...FLOW_READ,
      usage: {
        ...FLOW_READ.usage,
        series: { ...FLOW_READ.usage.series, cache_hit: [0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7] },
        by: { ...FLOW_READ.usage.by, model: [] },
      },
    };

    expect(tileOf("Cache hit ratio", read).line).toBe("within · warn < 60 %");
  });

  it("reads a window breach with the range label", () => {
    const read: FlowRead = {
      ...FLOW_READ,
      cost: {
        ...FLOW_READ.cost,
        series: { ...FLOW_READ.cost.series, leaked_usd: [], total_usd: [] },
      },
    };

    expect(tileOf("Leaked cost share", read).line).toBe("10.9 % 7d > 10 %");
    expect(tileOf("Leaked cost share", read).severity).toBe("warn");
  });

  it("shows no line for a null unpriced worker list", () => {
    const workers = FLOW_READ.usage.by.worker_name.filter((row) => row.unpriced_tokens === 0);
    const read: FlowRead = {
      ...FLOW_READ,
      usage: { ...FLOW_READ.usage, by: { ...FLOW_READ.usage.by, worker_name: workers } },
    };

    expect(tileOf("Unpriced tokens", read).line).toBeNull();
  });
});

describe("scorecardOf qualifier", () => {
  it("names the previous window and the same hour", () => {
    expect(scorecardOf(FLOW_READ, FRAME).qualifier).toBe(
      "vs Oct 17 – Oct 23 to the same hour · cost: list-price estimate, excludes 9.5 % unpriced tokens",
    );
  });

  it("names only the previous window with null same-hour sums", () => {
    const read = withoutSameHour();

    expect(scorecardOf(read, frameOf(read, "7d")).qualifier).toBe("vs Oct 17 – Oct 23");
  });

  it("says that no aggregates exist with a null previous window", () => {
    const read: FlowRead = { ...FLOW_READ, previous_window: null };

    expect(scorecardOf(read, frameOf(read, "7d")).qualifier).toBe("no comparison: no aggregates");
  });
});

describe("scorecardOf turns", () => {
  it("flags a read with no turn", () => {
    const read: FlowRead = {
      ...FLOW_READ,
      usage: { ...FLOW_READ.usage, current: { ...FLOW_READ.usage.current, turn_count: 0 } },
    };

    const scorecard = scorecardOf(read, frameOf(read, "7d"));
    expect(scorecard.noTurns).toBe(true);
    expect(scorecard.rows.map((row) => row.name)).toEqual(["Cost"]);
    expect(scorecardOf(FLOW_READ, FRAME).noTurns).toBe(false);
  });
});

describe("tileSignalsOf", () => {
  it("returns the four status signals with their bounds", () => {
    const signals = tileSignalsOf(FLOW_READ, FRAME);

    expect(signals.map((signal) => [signal.id, signal.where, signal.group, signal.short])).toEqual([
      ["tile.cost_per_success", "tile", "Cost", "cost per success"],
      ["tile.leaked_share", "tile", "Cost", "leaked cost"],
      ["tile.tokens_per_success", "tile", "Tokens", "tokens per success"],
      ["tile.cache_hit", "tile", "Tokens", "cache hit"],
    ]);
    expect(signals[1]?.bounds).toMatchObject({ direction: "high", warn: 0.1, bad: 0.2 });
  });

  it("holds the window value, the previous value and the series of a signal", () => {
    const signal = tileSignalsOf(FLOW_READ, FRAME)[0];

    expect(signal?.shown).toBeCloseTo(2.2557, 3);
    expect(signal?.previous).toBeCloseTo(2.0534, 3);
    expect(signal?.series?.[3]).toBeCloseTo(63.2 / 21, 6);
  });

  it("holds one slice for each model with at least 50 turns", () => {
    const signal = tileSignalsOf(FLOW_READ, FRAME)[3];

    expect(signal?.slices.map((slice) => slice.key)).toEqual([
      "claude-sonnet-4-5",
      "gpt-5-codex",
      "qwen3-coder",
    ]);
    expect(signal?.slices[1]?.window).toBeCloseTo(56.6 / 104, 6);
  });

  it("holds no slice for a model with fewer than 50 turns", () => {
    const small: FlowUsageRow = { ...modelRow("gpt-5-codex"), turn_count: 49 };
    const read = withModels([modelRow("claude-sonnet-4-5"), small]);
    const signal = tileSignalsOf(read, FRAME)[3];

    expect(signal?.slices.map((slice) => slice.key)).toEqual(["claude-sonnet-4-5"]);
    expect(tileOf("Cache hit ratio", read).slice).toBeNull();
  });

  it("holds no bounds when the previous window gives no reference", () => {
    const read: FlowRead = { ...FLOW_READ, cost: { ...FLOW_READ.cost, previous: null } };

    expect(tileSignalsOf(read, FRAME)[0]?.bounds).toBeNull();
    expect(tileOf("Cost per success", read).line).toBeNull();
  });
});
