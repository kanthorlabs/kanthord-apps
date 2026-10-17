import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import type {
  MissionExternalAction,
  MissionNodeRecord,
  NodeState,
  SchedulerExecutionRecord,
} from "@/api/types";
import type { Resource } from "@/hooks/use-resource";

vi.mock("@/api/resources/mission");
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import { useNodeControls } from "./use-node-controls";

function node(state: NodeState, attempt = 2): MissionNodeRecord {
  return {
    id: "node_team",
    work: "implement",
    requires: [],
    tasks: [],
    filename: "team.md",
    mission_id: "mission_1",
    visible_revision: 1,
    content: {
      name: "Team",
      requirement: "r",
      criterion: "c",
      verifications: [],
      bindings: [],
      work: "implement",
      requires: [],
    },
    retired_at: null,
    pinned_by_attempts: [],
    state,
    attempt,
    priority: 0,
    depends_on: [],
  };
}

function resource<T>(overrides: Partial<Resource<T>>): Resource<T> {
  return { data: null, error: null, loading: false, reload: vi.fn(), ...overrides };
}

function unresolved(): MissionExternalAction {
  return {
    node_id: "node_team",
    attempt: 2,
    action: {
      key: "repo.pull_request",
      binding_id: "binding_1",
      action: "pull_request",
      expected_end_state: "pull_request_merged",
      follows: null,
      configuration: { base_branch: "main", landing: "human" },
    },
    requested: true,
    request_evidence_id: "evidence_1",
    resolution: "unresolved",
  };
}

function ended(overrides: Partial<SchedulerExecutionRecord>): SchedulerExecutionRecord {
  return {
    execution_id: "execution_1",
    project_id: "prj-1",
    node_id: "node_team",
    claimant: {
      worker_binding_id: "binding_1",
      resource_identity: "worker:kanthord:general-main",
      runtime_identity: "worker_instance_01",
    },
    attempt: 2,
    pinned_revision: 1,
    node_branch: "kanthord/node_team",
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

function mount(
  target: MissionNodeRecord,
  actions: Resource<readonly MissionExternalAction[]>,
  executions: Resource<readonly SchedulerExecutionRecord[]>,
) {
  return renderHook(() =>
    useNodeControls({
      node: target,
      nodes: [target],
      missionVersion: 9,
      proposals: [],
      actions,
      executions,
      onChanged: vi.fn(),
    }),
  ).result.current;
}

const NONE = resource<readonly MissionExternalAction[]>({ data: [] });
const NO_RUNS = resource<readonly SchedulerExecutionRecord[]>({ data: [] });

describe("useNodeControls guard line", () => {
  it("names the read of a Paused node", () => {
    const state = mount(
      node("Paused"),
      resource({ loading: true }),
      resource<readonly SchedulerExecutionRecord[]>({ loading: true }),
    );

    expect(state.guardLine).toBe("Reading the executions and the external actions of attempt 2.");
    expect(state.retry).toBeNull();
    expect(state.resume.available).toBe(false);
  });

  it("names the read of another state with an open attempt", () => {
    const state = mount(node("Executing"), resource({ loading: true }), NO_RUNS);

    expect(state.guardLine).toBe("Reading the external actions of attempt 2.");
  });

  it("names a failed read and offers Retry that reads both again", () => {
    const actions = resource<readonly MissionExternalAction[]>({
      error: new ApiError("unreachable", "The daemon did not answer.", 0),
    });
    const executions = resource<readonly SchedulerExecutionRecord[]>({ data: [] });

    const paused = mount(node("Paused"), actions, executions);
    const executing = mount(node("Executing"), actions, executions);

    expect(paused.guardLine).toBe(
      "The executions or the external actions of attempt 2 could not be read: The daemon did not answer. The controls wait for them.",
    );
    expect(executing.guardLine).toBe(
      "The external actions of attempt 2 could not be read: The daemon did not answer. The controls wait for them.",
    );
    paused.retry?.();
    expect(actions.reload).toHaveBeenCalledTimes(1);
    expect(executions.reload).toHaveBeenCalledTimes(1);
  });

  it("states the unresolved request and offers the Resume sentence for a Paused node only", () => {
    const actions = resource<readonly MissionExternalAction[]>({ data: [unresolved()] });

    expect(mount(node("Paused"), actions, NO_RUNS).guardLine).toBe(
      "Attempt 2 has an unresolved pull request. Override and discard wait for its end state. Resume the node.",
    );
    expect(mount(node("Executing"), actions, NO_RUNS).guardLine).toBe(
      "Attempt 2 has an unresolved pull request. Override and discard wait for its end state.",
    );
  });

  it("states no line for a node without an open attempt", () => {
    expect(mount(node("Blocked", 3), NONE, NO_RUNS).guardLine).toBeNull();
    expect(mount(node("Pending", 0), NONE, NO_RUNS).guardLine).toBeNull();
  });
});

describe("useNodeControls", () => {
  it("derives the pause cause from the executions for the resume", () => {
    const executions = resource<readonly SchedulerExecutionRecord[]>({
      data: [ended({ stop: { reason: "budget_end", code: "turns" } })],
    });

    const state = mount(node("Paused"), NONE, executions);

    expect(state.resume.target).toBe("Waiting");
  });

  it("hides the section of a node that offers nothing", () => {
    expect(mount(node("Completed"), NONE, NO_RUNS).visible).toBe(false);
    expect(mount(node("Executing"), NONE, NO_RUNS).visible).toBe(true);
  });
});
