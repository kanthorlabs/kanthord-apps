import { describe, expect, it } from "vitest";

import type { SchedulerExecutionRecord } from "@/api/types";

import { endTimeOf, pauseCauseOf, pauseSentence, stopLabel, stopSentence } from "./execution-stop";

function execution(
  id: string,
  overrides: Partial<SchedulerExecutionRecord> = {},
): SchedulerExecutionRecord {
  return {
    execution_id: id,
    project_id: "prj-1",
    node_id: "node_1",
    claimant: {
      worker_binding_id: "binding_1",
      resource_identity: "worker:kanthord:general-main",
      runtime_identity: "worker_instance_01",
    },
    attempt: 1,
    pinned_revision: 1,
    node_branch: "kanthord/node_1",
    credentials: [],
    agent_selections: [],
    claim_state: "finished",
    expired_at: 9_000,
    created_at: 1_000,
    ended_at: 2_000,
    stop: null,
    trace_id: "0".repeat(32),
    root_span_id: "0".repeat(16),
    ...overrides,
  };
}

describe("stopLabel", () => {
  it("names the reason and the code of a provider failure", () => {
    expect(stopLabel({ reason: "provider_failed", code: "rate_limited" })).toBe(
      "Provider failed: rate limited",
    );
    expect(stopLabel({ reason: "provider_failed", code: "bad_request" })).toBe(
      "Provider failed: bad request",
    );
  });

  it("names the budget that ended", () => {
    expect(stopLabel({ reason: "budget_end", code: "wall_time" })).toBe("Budget ended: wall time");
    expect(stopLabel({ reason: "budget_end", code: "turns" })).toBe("Budget ended: turns");
  });

  it("names the reason alone when the code is null", () => {
    expect(stopLabel({ reason: "no_progress", code: null })).toBe("No progress");
  });

  it("keeps a free code of an operation failure as it is", () => {
    expect(stopLabel({ reason: "operation_failed", code: "repository.node_branch.missing" })).toBe(
      "Operation failed: repository.node_branch.missing",
    );
  });
});

const EXECUTION: SchedulerExecutionRecord = {
  execution_id: "execution_1",
  project_id: "prj-1",
  node_id: "n_a",
  claimant: {
    worker_binding_id: "binding_1",
    resource_identity: "worker:kanthord:general-main",
    runtime_identity: "worker_instance_01",
  },
  attempt: 1,
  pinned_revision: 1,
  node_branch: "kanthord/n_a",
  credentials: [],
  agent_selections: [],
  claim_state: "finished",
  expired_at: 300,
  created_at: 100,
  ended_at: 200,
  stop: null,
  trace_id: "0".repeat(31) + "1",
  root_span_id: "0".repeat(15) + "1",
};

describe("endTimeOf", () => {
  it("answers the release time of an ended execution", () => {
    expect(endTimeOf(EXECUTION)).toBe(200);
    expect(endTimeOf({ ...EXECUTION, claim_state: "lost", ended_at: 350 })).toBe(350);
  });

  it("answers the deadline of a lost execution that never ended", () => {
    expect(endTimeOf({ ...EXECUTION, claim_state: "lost", ended_at: null })).toBe(300);
  });

  it("answers null for a running execution", () => {
    expect(endTimeOf({ ...EXECUTION, claim_state: "running", ended_at: null })).toBeNull();
  });
});

describe("stopSentence", () => {
  it("names the reason and the code in a sentence", () => {
    expect(stopSentence({ reason: "provider_failed", code: "rate_limited" })).toBe(
      "provider failed (rate limited)",
    );
    expect(stopSentence({ reason: "no_progress", code: null })).toBe("no progress");
  });
});

describe("pauseSentence", () => {
  it("names the stop of the last execution at the Failure limit", () => {
    const stopped = execution("e1", { stop: { reason: "provider_failed", code: "rate_limited" } });

    expect(pauseSentence(pauseCauseOf([stopped]))).toBe(
      "The last execution ended: provider failed (rate limited).",
    );
  });

  it("names a lost execution at the Failure limit", () => {
    const lost = execution("e1", { claim_state: "lost", ended_at: null });

    expect(pauseSentence(pauseCauseOf([lost]))).toBe("The last execution ended: lost.");
  });

  it("names the budget code at the Further-work limit", () => {
    const budget = execution("e1", { stop: { reason: "budget_end", code: "turns" } });
    const bare = execution("e2", { stop: { reason: "budget_end", code: null } });

    expect(pauseSentence(pauseCauseOf([budget]))).toBe(
      "The last execution ended at its budget (turns).",
    );
    expect(pauseSentence(pauseCauseOf([bare]))).toBe("The last execution ended at its budget.");
  });

  it("states that no limit explains a pause by a human", () => {
    expect(pauseSentence(pauseCauseOf([]))).toBe("No execution limit explains the pause.");
  });
});

describe("pauseCauseOf", () => {
  it("ignores a running execution that holds no end time", () => {
    const running = execution("e1", { claim_state: "running", ended_at: null });

    expect(pauseCauseOf([running])).toEqual({ cause: "human", execution: null, endedAt: null });
  });

  it("names a pause by a human when no execution exists", () => {
    expect(pauseCauseOf([])).toEqual({ cause: "human", execution: null, endedAt: null });
  });

  it("names the Failure limit after a lost execution", () => {
    const lost = execution("e1", { claim_state: "lost", ended_at: null });

    expect(pauseCauseOf([lost])).toEqual({
      cause: "failure-limit",
      execution: lost,
      endedAt: 9_000,
    });
  });

  it("names the Failure limit after any stop but the budget end", () => {
    const failed = execution("e1", { stop: { reason: "operation_failed", code: null } });

    expect(pauseCauseOf([failed]).cause).toBe("failure-limit");
  });

  it("names the Further-work limit after a budget end", () => {
    const budget = execution("e1", { stop: { reason: "budget_end", code: "wall_time" } });

    expect(pauseCauseOf([budget])).toEqual({
      cause: "further-work-limit",
      execution: budget,
      endedAt: 2_000,
    });
  });

  it("names a pause by a human after an execution that ended with no stop", () => {
    expect(pauseCauseOf([execution("e1")]).cause).toBe("human");
  });

  it("judges by the latest end, whatever the order of the list", () => {
    const early = execution("e1", {
      stop: { reason: "budget_end", code: "turns" },
      ended_at: 1_500,
    });
    const late = execution("e2", {
      stop: { reason: "provider_failed", code: "unavailable" },
      ended_at: 3_000,
    });

    expect(pauseCauseOf([late, early]).execution).toBe(late);
    expect(pauseCauseOf([early, late]).cause).toBe("failure-limit");
  });
});
