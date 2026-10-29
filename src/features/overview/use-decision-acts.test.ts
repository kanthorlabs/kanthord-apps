import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { listTracePage } from "@/api/resources/tracking";
import type {
  Intent,
  MissionExternalAction,
  MissionNodeRecord,
  MissionProposal,
  NodeState,
  Project,
  SchedulerExecutionRecord,
  TraceListItem,
} from "@/api/types";
import { type AttentionDetail, type DecisionAttentionItem, detailKeyOf } from "@/lib/attention";

vi.mock("@/api/resources/mission");
vi.mock("@/api/resources/tracking");
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import { useDecisionActs } from "./use-decision-acts";

const PROJECT: Project = {
  id: "prj-1",
  name: "kanthord",
  binding_set_version: 1,
  created_at: 1,
  paused_at: null,
  workspace_directory: "/state/prj-1",
};

function node(intent: Intent, state: NodeState): MissionNodeRecord {
  return {
    id: "node_1",
    intent,
    tags: [],
    tasks: [],
    filename: "node_1.md",
    mission_id: "mission_1",
    visible_revision: 1,
    content: {
      name: "Team",
      requirement: "r",
      criterion: "c",
      verifications: [],
      bindings: [],
      intent,
      tags: [],
    },
    retired_at: null,
    pinned_by_attempts: [],
    pinned_revision: null,
    state,
    attempt: 2,
    priority: 0,
    depends_on: [],
  };
}

function proposal(id: string, attempt: number, approvedAt: number | null): MissionProposal {
  return {
    id,
    node_id: "node_1",
    attempt,
    assessment_id: "assessment_1",
    content: {
      dependency_id: "node_2",
      name: id,
      requirement: "r",
      criterion: "c",
      task: { name: "t", requirement: "r", criterion: "c", verifications: ["v"] },
    },
    created_node_id: null,
    approved_at: approvedAt,
    rejected_at: null,
    created_at: 1,
  };
}

function unresolved(): MissionExternalAction {
  return {
    node_id: "node_1",
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

function actsOf(item: DecisionAttentionItem, detail: AttentionDetail | null) {
  return renderHook(() =>
    useDecisionActs(item, detail, { reload: vi.fn(), markActed: vi.fn(), setDialogOpen: vi.fn() }),
  ).result.current;
}

const listMock = vi.mocked(listTracePage);

function pausedItemOf(target: MissionNodeRecord): DecisionAttentionItem {
  return {
    id: "paused:node_1",
    kind: "paused",
    group: "decisions",
    project: PROJECT,
    subject: target.content.name,
    missionVersion: 7,
    node: target,
    nodes: [target],
    at: null,
    pause: null,
    cause: null,
  };
}

function pausedDetailOf(
  target: MissionNodeRecord,
  executions: readonly SchedulerExecutionRecord[],
): AttentionDetail {
  return {
    kind: "paused",
    key: detailKeyOf(target),
    executions: { status: "ready", data: executions },
    actions: { status: "ready", data: [] },
  };
}

function executionOf(id: string, createdAt: number): SchedulerExecutionRecord {
  return {
    execution_id: id,
    trace_id: `trace_${id}`,
    created_at: createdAt,
  } as SchedulerExecutionRecord;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("useDecisionActs", () => {
  it("exposes the open proposals of a Blocked examine node", () => {
    const target = node("examine", "Blocked");
    const item: DecisionAttentionItem = {
      id: "blocked:node_1",
      kind: "blocked",
      group: "decisions",
      project: PROJECT,
      subject: target.content.name,
      missionVersion: 7,
      node: target,
      nodes: [target],
      at: null,
      cause: "Criterion not met",
    };
    const detail: AttentionDetail = {
      kind: "blocked",
      key: detailKeyOf(target),
      assessment: { status: "ready", data: null },
      proposals: {
        status: "ready",
        data: [
          proposal("open", 2, null),
          proposal("approved", 2, 5),
          { ...proposal("rejected", 2, null), rejected_at: 6 },
          proposal("old", 1, null),
        ],
      },
    };

    expect(actsOf(item, detail).proposals.map((entry) => entry.id)).toEqual(["open"]);
    expect(actsOf(item, null).proposals).toEqual([]);
  });

  it("exposes the unresolved request sentence of a Paused node", () => {
    const target = node("implement", "Paused");
    const item: DecisionAttentionItem = {
      id: "paused:node_1",
      kind: "paused",
      group: "decisions",
      project: PROJECT,
      subject: target.content.name,
      missionVersion: 7,
      node: target,
      nodes: [target],
      at: null,
      pause: null,
      cause: null,
    };
    const detail: AttentionDetail = {
      kind: "paused",
      key: detailKeyOf(target),
      executions: { status: "ready", data: [] },
      actions: { status: "ready", data: [unresolved()] },
    };

    const acts = actsOf(item, detail);

    expect(acts.unresolved).toBe(
      "Attempt 2 has an unresolved pull request. Override and discard wait for its end state. Resume the node.",
    );
    expect(acts.discard.available).toBe(false);
    expect(actsOf(item, null).unresolved).toBeNull();
  });

  it("answers the cause of the last trace of a Paused node", async () => {
    const target = node("implement", "Paused");
    listMock.mockResolvedValue({
      items: [
        {
          cause: { category: "llm_provider", assigner: "rule", subcategory: "rate_limited" },
        } as TraceListItem,
      ],
      next_cursor: null,
    });

    const { result } = renderHook(() =>
      useDecisionActs(
        pausedItemOf(target),
        pausedDetailOf(target, [executionOf("old", 1), executionOf("new", 2)]),
        { reload: vi.fn(), markActed: vi.fn(), setDialogOpen: vi.fn() },
      ),
    );

    await waitFor(() =>
      expect(result.current.lastTraceCause).toEqual({
        category: "llm_provider",
        assigner: "rule",
        subcategory: "rate_limited",
      }),
    );
    expect(listMock).toHaveBeenCalledWith({ execution_id: "new" }, null, 1);
    expect(result.current.lastTraceId).toBe("trace_new");
  });

  it("keeps the last trace and answers no cause when the read fails", async () => {
    const target = node("implement", "Paused");
    listMock.mockRejectedValue(new ApiError("unreachable", "No answer.", 0));

    const { result } = renderHook(() =>
      useDecisionActs(pausedItemOf(target), pausedDetailOf(target, [executionOf("e1", 1)]), {
        reload: vi.fn(),
        markActed: vi.fn(),
        setDialogOpen: vi.fn(),
      }),
    );

    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1));
    expect(result.current.lastTraceCause).toBeNull();
    expect(result.current.lastTraceId).toBe("trace_e1");
  });
});
