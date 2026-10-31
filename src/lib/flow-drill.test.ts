import { describe, expect, it } from "vitest";

import type { FlowRead } from "@/api/types";

import flowRead from "../../test/flow-read.json";
import {
  causeTarget,
  costTabTarget,
  dayTarget,
  drillPath,
  flowDataTarget,
  signalTarget,
  sliceParamsOf,
  spanOf,
  splitRowTarget,
  stopReasonTarget,
  targetLabel,
} from "./flow-drill";

const FLOW_READ = flowRead as unknown as FlowRead;

const SPAN = { from: 1000, to: 2000 };
const RANGE = "from=1000&to=2000";
const NO_SLICE = { project_id: null, worker_name: null };
const SLICE = { project_id: "billing", worker_name: "coder@1" };
const SLICE_QUERY = "project_id=billing&worker_name=coder%401";
const SCOPE = { projectId: "billing", workerName: "coder@1" };
const NO_SCOPE = { projectId: null, workerName: null };

describe("drillPath", () => {
  it("writes the params in the given order", () => {
    expect(drillPath("/traces", { state: "error", q: "x", from: 1 })).toBe(
      "/traces?state=error&q=x&from=1",
    );
  });

  it("drops an absent value", () => {
    expect(drillPath("/traces", { state: null, q: undefined, from: 0 })).toBe("/traces?from=0");
  });

  it("writes the bare path with no param", () => {
    expect(drillPath("/scheduler", {})).toBe("/scheduler");
  });
});

describe("targetLabel", () => {
  it("answers the label of each target", () => {
    expect(targetLabel("/traces?state=error&from=1")).toBe("Traces");
    expect(targetLabel("/timeline?project_id=billing")).toBe("Timeline");
    expect(targetLabel("/scheduler")).toBe("Scheduler");
    expect(targetLabel("/")).toBe("Overview");
  });

  it("rejects a path with no label", () => {
    expect(() => targetLabel("/analytics?tab=cost")).toThrow("No drill label");
  });
});

describe("spanOf", () => {
  it("starts at the first bucket and ends at the end of the last bucket", () => {
    expect(spanOf(FLOW_READ, 1, 2)).toEqual({
      from: 1792886400000,
      to: 1793059200000,
    });
  });

  it("ends at window.now for a run that ends on the partial bucket", () => {
    expect(spanOf(FLOW_READ, 5, 6)).toEqual({ from: 1793232000000, to: 1793369520000 });
  });

  it("ends at the end of the last bucket when no bucket is partial", () => {
    const read = { ...FLOW_READ, window: { ...FLOW_READ.window, now: FLOW_READ.window.to } };

    expect(spanOf(read, 5, 6)).toEqual({ from: 1793232000000, to: 1793404800000 });
  });

  it("reads hour buckets by the hour", () => {
    const read = {
      ...FLOW_READ,
      window: { ...FLOW_READ.window, bucket: "hour" as const, now: FLOW_READ.window.to },
    };

    expect(spanOf(read, 0, 0)).toEqual({ from: 1792800000000, to: 1792800000000 + 3_600_000 });
  });

  it("rejects an index with no bucket", () => {
    expect(() => spanOf(FLOW_READ, 0, 7)).toThrow(RangeError);
  });
});

describe("sliceParamsOf", () => {
  it("reads a project key as a project and another key as a worker", () => {
    expect(sliceParamsOf(FLOW_READ, ["billing"])).toEqual({
      project_id: "billing",
      worker_name: null,
    });
    expect(sliceParamsOf(FLOW_READ, ["coder@1"])).toEqual({
      project_id: null,
      worker_name: "coder@1",
    });
    expect(sliceParamsOf(FLOW_READ, ["coder@1", "docs-site"])).toEqual({
      project_id: "docs-site",
      worker_name: "coder@1",
    });
    expect(sliceParamsOf(FLOW_READ, [])).toEqual(NO_SLICE);
  });
});

describe("signalTarget", () => {
  const sliced: readonly (readonly [string, string, string])[] = [
    [
      "executing.leak",
      `/traces?state=error&${SLICE_QUERY}&${RANGE}`,
      `/traces?state=error&${RANGE}`,
    ],
    [
      "evaluation.leak",
      `/traces?state=error&${SLICE_QUERY}&${RANGE}`,
      `/traces?state=error&${RANGE}`,
    ],
    [
      "executing.turn_rate_limited",
      `/traces?error_type=rate_limited&${SLICE_QUERY}&${RANGE}`,
      `/traces?error_type=rate_limited&${RANGE}`,
    ],
    [
      "executing.turn_quota_exhausted",
      `/traces?error_type=quota_exhausted&${SLICE_QUERY}&${RANGE}`,
      `/traces?error_type=quota_exhausted&${RANGE}`,
    ],
    [
      "executing.turn_unavailable",
      `/traces?error_type=unavailable&${SLICE_QUERY}&${RANGE}`,
      `/traces?error_type=unavailable&${RANGE}`,
    ],
    ["verification.flaky", `/traces?${SLICE_QUERY}&${RANGE}`, `/traces?${RANGE}`],
    ["verification.loops", `/traces?${SLICE_QUERY}&${RANGE}`, `/traces?${RANGE}`],
    ["verification.fail", `/traces?${SLICE_QUERY}&${RANGE}`, `/traces?${RANGE}`],
    ["verification.base_red", `/traces?${SLICE_QUERY}&${RANGE}`, `/traces?${RANGE}`],
    ["verification.time", `/traces?${SLICE_QUERY}&${RANGE}`, `/traces?${RANGE}`],
    ["executing.time", `/traces?${SLICE_QUERY}&${RANGE}`, `/traces?${RANGE}`],
    ["release_gate.time", `/traces?${SLICE_QUERY}&${RANGE}`, `/traces?${RANGE}`],
    ["evaluation.time", `/traces?${SLICE_QUERY}&${RANGE}`, `/traces?${RANGE}`],
    [
      "release_gate.leak",
      `/traces?state=error&q=operation_failed&${SLICE_QUERY}&${RANGE}`,
      `/traces?state=error&q=operation_failed&${RANGE}`,
    ],
    ["outcome.rework", `/timeline?project_id=billing&${RANGE}`, `/timeline?${RANGE}`],
    [
      "tile.cache_hit",
      `/traces?model=coder%401&sort=total_tokens&${RANGE}`,
      `/traces?sort=total_tokens&${RANGE}`,
    ],
    [
      "data.awaiting",
      `/traces?worker_name=coder%401&state=ok&${RANGE}`,
      `/traces?state=ok&${RANGE}`,
    ],
    [
      "data.completeness",
      `/traces?worker_name=coder%401&state=ok&${RANGE}`,
      `/traces?state=ok&${RANGE}`,
    ],
    ["tile.unpriced", `/traces?worker_name=coder%401&${RANGE}`, `/traces?${RANGE}`],
  ];

  it.each(sliced)("answers %s with and without a slice", (id, withSlice, withoutSlice) => {
    expect(signalTarget(id, SLICE, SPAN)).toBe(withSlice);
    expect(signalTarget(id, NO_SLICE, SPAN)).toBe(withoutSlice);
  });

  const fixed: readonly (readonly [string, string])[] = [
    ["queued.wait", "/scheduler"],
    ["evaluation.review", "/scheduler"],
    ["outcome.blocked", "/"],
    ["executing.tool_error", `/traces?error_type=tool_error&${RANGE}`],
    ["tile.cost_per_success", `/traces?sort=cost_usd&${RANGE}`],
    ["tile.total_cost", `/traces?sort=cost_usd&${RANGE}`],
    ["tile.rejected_review_cost", `/traces?sort=cost_usd&${RANGE}`],
    ["tile.leaked_share", `/traces?state=error&sort=cost_usd&${RANGE}`],
    ["tile.tokens_per_success", `/traces?sort=total_tokens&${RANGE}`],
    ["tile.total_tokens", `/traces?sort=total_tokens&${RANGE}`],
    ["causes.unattributed", `/traces?cause_category=unattributed&sort=cost_usd&${RANGE}`],
  ];

  it.each(fixed)("answers %s with or without a slice", (id, path) => {
    expect(signalTarget(id, SLICE, SPAN)).toBe(path);
    expect(signalTarget(id, NO_SLICE, SPAN)).toBe(path);
  });

  it("carries no project on a scheduler path", () => {
    expect(signalTarget("queued.wait", SLICE, SPAN)).not.toContain("project_id");
  });

  it("rejects an id with no path", () => {
    expect(() => signalTarget("unknown.signal", SLICE, SPAN)).toThrow("No drill path");
  });
});

describe("dayTarget", () => {
  it("opens the timeline of the project for queued, evaluation and outcome", () => {
    for (const stage of ["queued", "evaluation", "outcome"] as const) {
      expect(dayTarget(stage, SCOPE, SPAN)).toBe(`/timeline?project_id=billing&${RANGE}`);
      expect(dayTarget(stage, NO_SCOPE, SPAN)).toBe(`/timeline?${RANGE}`);
    }
  });

  it("opens the failed traces with the worker and the project for executing", () => {
    expect(dayTarget("executing", SCOPE, SPAN)).toBe(
      `/traces?state=error&${RANGE}&worker_name=coder%401&project_id=billing`,
    );
    expect(dayTarget("executing", NO_SCOPE, SPAN)).toBe(`/traces?state=error&${RANGE}`);
  });

  it("opens the traces of the scope for verification", () => {
    expect(dayTarget("verification", SCOPE, SPAN)).toBe(`/traces?${SLICE_QUERY}&${RANGE}`);
    expect(dayTarget("verification", NO_SCOPE, SPAN)).toBe(`/traces?${RANGE}`);
  });

  it("opens the failed operations for release_gate with no scope", () => {
    expect(dayTarget("release_gate", SCOPE, SPAN)).toBe(
      `/traces?state=error&q=operation_failed&${RANGE}`,
    );
    expect(dayTarget("release_gate", NO_SCOPE, SPAN)).toBe(
      `/traces?state=error&q=operation_failed&${RANGE}`,
    );
  });
});

describe("causeTarget", () => {
  it("opens the traces of a cause category with and without a scope", () => {
    expect(causeTarget("model", SCOPE, SPAN)).toBe(
      `/traces?cause_category=model&${SLICE_QUERY}&${RANGE}`,
    );
    expect(causeTarget("model", NO_SCOPE, SPAN)).toBe(`/traces?cause_category=model&${RANGE}`);
  });
});

describe("stopReasonTarget", () => {
  it("opens the traces that match a stop reason", () => {
    expect(stopReasonTarget("provider_failed", SPAN)).toBe(`/traces?q=provider_failed&${RANGE}`);
  });

  it("opens the failed traces for the row All failures", () => {
    expect(stopReasonTarget(null, SPAN)).toBe(`/traces?state=error&${RANGE}`);
  });
});

describe("splitRowTarget", () => {
  it("opens the traces of a split row sorted by cost", () => {
    expect(splitRowTarget("model", "gpt-5-codex", SPAN)).toBe(
      `/traces?model=gpt-5-codex&sort=cost_usd&${RANGE}`,
    );
    expect(splitRowTarget("worker_name", "coder@1", SPAN)).toBe(
      `/traces?worker_name=coder%401&sort=cost_usd&${RANGE}`,
    );
    expect(splitRowTarget("project_id", "billing", SPAN)).toBe(
      `/traces?project_id=billing&sort=cost_usd&${RANGE}`,
    );
  });
});

describe("costTabTarget and flowDataTarget", () => {
  it("keep the set filters", () => {
    const filters = { ...SCOPE, range: "30d" as const };

    expect(costTabTarget(filters)).toBe(
      "/analytics?tab=cost&project_id=billing&worker_name=coder%401&range=30d",
    );
    expect(flowDataTarget(filters)).toBe(
      "/analytics?tab=flow&project_id=billing&worker_name=coder%401&range=30d#flow-data",
    );
  });

  it("drop an absent filter", () => {
    const filters = { projectId: "billing", workerName: null, range: "7d" as const };

    expect(costTabTarget(filters)).toBe("/analytics?tab=cost&project_id=billing&range=7d");
    expect(flowDataTarget({ ...NO_SCOPE, range: "24h" })).toBe(
      "/analytics?tab=flow&range=24h#flow-data",
    );
  });
});
