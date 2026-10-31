import { describe, expect, it } from "vitest";

import type { FlowRead, FlowUsageRow } from "@/api/types";

import flowRead from "../../test/flow-read.json";
import { splitOf, type StageSplit, type UsageSplit, type UsageSplitRow } from "./flow-split";
import { frameOf } from "./flow-status";

const FLOW_READ = flowRead as unknown as FlowRead;
const FRAME = frameOf(FLOW_READ, "7d");

function usageSplit(split: "model" | "worker_name" | "project_id", read = FLOW_READ): UsageSplit {
  const model = splitOf(read, frameOf(read, "7d"), split);
  if (model.kind !== "usage") throw new Error("Not a usage split");
  return model;
}

function stageSplit(): StageSplit {
  const model = splitOf(FLOW_READ, FRAME, "stage");
  if (model.kind !== "stage") throw new Error("Not a stage split");
  return model;
}

function rowOf(rows: readonly UsageSplitRow[], key: string): UsageSplitRow {
  const row = rows.find((candidate) => candidate.key === key);
  if (row === undefined) throw new Error(`No row ${key}`);
  return row;
}

function summary(row: UsageSplitRow): string {
  const delta = row.delta?.text ?? "—";
  const share = row.share?.text ?? "—";
  return [row.key, row.cost, share, delta, row.cache.text, row.perMillion].join(" ");
}

describe("splitOf by model", () => {
  it("lists the models by cost and then the row All", () => {
    expect(usageSplit("model").rows.map(summary)).toEqual([
      "claude-sonnet-4-5 $236 57 % +$29 74.4 % $0.75",
      "gpt-5-codex $114 28 % +$22 54.4 % $1.08",
      "qwen3-coder $62.10 15 % +$12 64.2 % $0.36",
      "All $413 100 % +$63 68.5 % $0.70",
    ]);
  });

  it("reads the tokens, the turns and the unpriced tokens of the row All", () => {
    const row = rowOf(usageSplit("model").rows, "All");

    expect(row).toMatchObject({
      tokens: "645 M (442 M) / 9.5 M",
      turns: "18,490",
      unpriced: "61.9 M",
      all: true,
      target: null,
    });
  });

  it("reads a dash for the unpriced tokens of a priced row without any", () => {
    expect(rowOf(usageSplit("model").rows, "gpt-5-codex").unpriced).toBe("—");
  });

  it("shows the cache hit status of a model row and of All", () => {
    const { rows } = usageSplit("model");

    expect(rowOf(rows, "gpt-5-codex").cache.status).toBe("bad");
    expect(rowOf(rows, "qwen3-coder").cache.status).toBe("ok");
    expect(rowOf(rows, "All").cache.status).toBe("ok");
  });

  it("gives the cache hit series with both bounds", () => {
    expect(rowOf(usageSplit("model").rows, "gpt-5-codex").cache).toMatchObject({
      series: [0.71, 0.7, 0.72, 0.71, 0.34, 0.32, 0.31],
      warn: 0.6,
      bad: 0.4,
    });
  });

  it("gives the cost by day of each row with one shared scale", () => {
    const split = usageSplit("model");

    expect(rowOf(split.rows, "qwen3-coder").days).toEqual([8.8, 9.1, 9.4, 8.1, 8.9, 9.0, 8.8]);
    expect(rowOf(split.rows, "All").days).toEqual(FLOW_READ.cost.series.total_usd);
    expect(split.dayScale).toBe(63.2);
    expect(split.partial).toBe(true);
  });

  it("scales the share bar and the diverging delta bar", () => {
    const { rows } = usageSplit("model");

    expect(rowOf(rows, "claude-sonnet-4-5").share?.fraction).toBeCloseTo(0.5727, 3);
    expect(rowOf(rows, "All").delta?.fraction).toBe(1);
    expect(rowOf(rows, "gpt-5-codex").delta?.fraction).toBeCloseTo(22.3 / 63.2, 6);
  });

  it("opens the key of a row with the window span and no link for All", () => {
    const { rows } = usageSplit("model");

    expect(rowOf(rows, "gpt-5-codex").target).toBe(
      "/traces?model=gpt-5-codex&sort=cost_usd&from=1792800000000&to=1793369520000",
    );
  });

  it("reads a dash for the delta with null same-hour sums", () => {
    const read: FlowRead = {
      ...FLOW_READ,
      usage: {
        ...FLOW_READ.usage,
        previous_same_hour: null,
        by: {
          ...FLOW_READ.usage.by,
          model: FLOW_READ.usage.by.model.map((row): FlowUsageRow => ({
            ...row,
            previous_same_hour: null,
          })),
        },
      },
    };

    expect(usageSplit("model", read).rows.map((row) => row.delta)).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });
});

describe("splitOf by worker", () => {
  it("sorts the unpriced rows last before All", () => {
    expect(usageSplit("worker_name").rows.map((row) => row.key)).toEqual([
      "tdd@1",
      "reviewer@1",
      "coder@1",
      "claude-code@1",
      "All",
    ]);
  });

  it("reads an unpriced row without cost, share, delta or price", () => {
    expect(rowOf(usageSplit("worker_name").rows, "claude-code@1")).toMatchObject({
      cost: "unpriced",
      share: null,
      delta: null,
      perMillion: "—",
      unpriced: "61.9 M",
    });
  });

  it("shows no cache hit status on a worker row", () => {
    expect(rowOf(usageSplit("worker_name").rows, "reviewer@1").cache.status).toBe("ok");
  });
});

describe("splitOf by project", () => {
  it("opens a project key with the project filter", () => {
    expect(rowOf(usageSplit("project_id").rows, "billing").target).toBe(
      "/traces?project_id=billing&sort=cost_usd&from=1792800000000&to=1793369520000",
    );
  });
});

describe("splitOf by stage", () => {
  it("lists one row for each stage and then All", () => {
    expect(stageSplit().rows.map((row) => row.key)).toEqual([
      "Queued",
      "Executing",
      "Verification",
      "Release gate",
      "Evaluation",
      "Outcome",
      "All",
    ]);
  });

  it("reads the release gate row", () => {
    const row = stageSplit().rows.find((candidate) => candidate.key === "Release gate");

    expect(row).toMatchObject({
      ended: "$4.30",
      share: { text: "67 %" },
      leaked: "$3.40",
      handedOn: "$271",
    });
  });

  it("sums ended here and handed on to the total cost in the row All", () => {
    const row = stageSplit().rows.at(-1);

    expect(row?.share.text).toBe("100 %");
    expect(row?.all).toBe(true);
  });

  it("states the note with the total cost", () => {
    expect(stageSplit().note).toBe("Ended here + handed on = $413, the total cost.");
  });
});
