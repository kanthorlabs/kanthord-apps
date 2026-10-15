import { describe, expect, it } from "vitest";

import type { SchedulerExecutionRecord } from "@/api/types";

import { endTimeOf, stopLabel } from "./execution-stop";

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
