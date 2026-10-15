import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";

vi.mock("@/api/resources/mission", () => ({
  listNodeAssessments: vi.fn(),
  listNodeExternalActions: vi.fn(),
  listNodeProposals: vi.fn(),
}));

vi.mock("@/api/resources/scheduler", () => ({
  listNodeExecutions: vi.fn(),
}));

import {
  listNodeAssessments,
  listNodeExternalActions,
  listNodeProposals,
} from "@/api/resources/mission";
import { listNodeExecutions } from "@/api/resources/scheduler";
import type { MissionRunnableNode, NodeState } from "@/api/types";
import { detailKeyOf, type DetailTarget } from "@/lib/attention";

import { useAttentionDetails } from "./use-attention-details";

function node(
  id: string,
  state: NodeState,
  overrides: Partial<MissionRunnableNode> = {},
): MissionRunnableNode {
  return {
    id,
    filename: `${id}.md`,
    mission_id: "mission_1",
    parent_id: null,
    visible_revision: 1,
    content: { name: id, requirement: "", criterion: "", verifications: [], bindings: [] },
    retired_at: null,
    pinned_by_attempts: [],
    kind: "objective",
    state,
    attempt: 2,
    priority: 0,
    depends_on: [],
    ...overrides,
  };
}

function blocked(id: string, overrides: Partial<MissionRunnableNode> = {}): DetailTarget {
  return {
    kind: "blocked",
    projectId: "prj-1",
    node: node(id, "Blocked", {
      blocked_context: {
        outcome: {
          id: "outcome_1",
          node_id: id,
          attempt: 2,
          node_revision: 1,
          closing_event: "assessment-not-passed",
          result: "criterion-not-met",
          assessment_id: "assessment_1",
          evidence_ids: [],
          created_at: 1,
        },
        requests: [],
      },
      ...overrides,
    }),
  };
}

function paused(id: string, overrides: Partial<MissionRunnableNode> = {}): DetailTarget {
  return { kind: "paused", projectId: "prj-1", node: node(id, "Paused", overrides) };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listNodeAssessments).mockResolvedValue([]);
  vi.mocked(listNodeProposals).mockResolvedValue([]);
  vi.mocked(listNodeExecutions).mockResolvedValue([]);
  vi.mocked(listNodeExternalActions).mockResolvedValue([]);
});

describe("useAttentionDetails", () => {
  it("reads the assessment of the outcome attempt and the proposals of an initiative", async () => {
    const target = blocked("n1", { kind: "initiative" });

    const { result } = renderHook(() => useAttentionDetails([target]));

    await waitFor(() => expect(result.current.details.get("n1")?.kind).toBe("blocked"));
    expect(listNodeAssessments).toHaveBeenCalledWith("n1", 2);
    expect(listNodeProposals).toHaveBeenCalledWith("n1");
  });

  it("reads no proposals for an objective", async () => {
    const target = blocked("n1");

    const { result } = renderHook(() => useAttentionDetails([target]));

    await waitFor(() => expect(result.current.details.get("n1")).toBeDefined());
    expect(listNodeProposals).not.toHaveBeenCalled();
  });

  it("reads the executions and the external actions of a Paused node for its attempt", async () => {
    const target = paused("n2", { attempt: 4 });

    const { result } = renderHook(() => useAttentionDetails([target]));

    await waitFor(() => expect(result.current.details.get("n2")?.kind).toBe("paused"));
    expect(listNodeExecutions).toHaveBeenCalledWith("prj-1", "n2", 4);
    expect(listNodeExternalActions).toHaveBeenCalledWith("n2", 4);
  });

  it("reads the external actions of an open attempt and no executions", async () => {
    const target: DetailTarget = {
      kind: "open",
      projectId: "prj-1",
      node: node("n3", "Pending", { attempt: 2, depends_on: ["n9"] }),
    };

    const { result } = renderHook(() => useAttentionDetails([target]));

    await waitFor(() => expect(result.current.details.get("n3")?.kind).toBe("open"));
    expect(listNodeExternalActions).toHaveBeenCalledWith("n3", 2);
    expect(listNodeExecutions).not.toHaveBeenCalled();
  });

  it("answers empty reads without a call for a Paused node at attempt 0", async () => {
    const target = paused("n2", { attempt: 0 });

    const { result } = renderHook(() => useAttentionDetails([target]));

    await waitFor(() =>
      expect(result.current.details.get("n2")).toEqual({
        kind: "paused",
        key: detailKeyOf(target.node),
        executions: { status: "ready", data: [] },
        actions: { status: "ready", data: [] },
      }),
    );
    expect(listNodeExecutions).not.toHaveBeenCalled();
    expect(listNodeExternalActions).not.toHaveBeenCalled();
  });

  it("reads a detail once for one key, across renders and new target lists", async () => {
    const { result, rerender } = renderHook(({ targets }) => useAttentionDetails(targets), {
      initialProps: { targets: [paused("n2")] },
    });
    await waitFor(() => expect(result.current.details.get("n2")).toBeDefined());

    rerender({ targets: [paused("n2")] });
    rerender({ targets: [paused("n2")] });

    expect(listNodeExecutions).toHaveBeenCalledTimes(1);
    expect(listNodeExternalActions).toHaveBeenCalledTimes(1);
  });

  it("reads again when the attempt, the state or the revision changes", async () => {
    const { result, rerender } = renderHook(({ targets }) => useAttentionDetails(targets), {
      initialProps: { targets: [paused("n2")] },
    });
    await waitFor(() => expect(result.current.details.get("n2")).toBeDefined());

    rerender({ targets: [paused("n2", { attempt: 3 })] });
    await waitFor(() => expect(listNodeExecutions).toHaveBeenCalledTimes(2));
    rerender({ targets: [paused("n2", { attempt: 3, visible_revision: 2 })] });
    await waitFor(() => expect(listNodeExecutions).toHaveBeenCalledTimes(3));

    expect(listNodeExecutions).toHaveBeenLastCalledWith("prj-1", "n2", 3);
  });

  it("keeps the key of the read in the detail", async () => {
    const target = paused("n2");

    const { result } = renderHook(() => useAttentionDetails([target]));

    await waitFor(() => expect(result.current.details.get("n2")).toBeDefined());
    expect(result.current.details.get("n2")?.key).toBe(detailKeyOf(target.node));
  });

  it("reads again on refresh, for the dialog and for Retry", async () => {
    const target = paused("n2");
    const { result } = renderHook(() => useAttentionDetails([target]));
    await waitFor(() => expect(result.current.details.get("n2")).toBeDefined());

    act(() => result.current.refresh("n2"));

    await waitFor(() => expect(listNodeExecutions).toHaveBeenCalledTimes(2));
  });

  it("starts no second read while the first read of the same key runs", async () => {
    let answer: (value: []) => void = () => undefined;
    vi.mocked(listNodeExecutions).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    const target = paused("n2");
    const { result } = renderHook(() => useAttentionDetails([target]));
    await waitFor(() => expect(listNodeExecutions).toHaveBeenCalledTimes(1));

    act(() => result.current.refresh("n2"));
    act(() => result.current.refresh("n2"));
    answer([]);

    await waitFor(() => expect(result.current.details.get("n2")).toBeDefined());
    expect(listNodeExecutions).toHaveBeenCalledTimes(1);
  });

  it("keeps a failed read until the key changes or a refresh runs", async () => {
    vi.mocked(listNodeExecutions).mockRejectedValue(
      new ApiError("unreachable", "The daemon did not answer.", 0),
    );
    const target = paused("n2");
    const { result, rerender } = renderHook(({ targets }) => useAttentionDetails(targets), {
      initialProps: { targets: [target] },
    });
    await waitFor(() => expect(result.current.details.get("n2")).toBeDefined());

    const detail = result.current.details.get("n2");
    expect(detail?.kind === "paused" && detail.executions).toEqual({
      status: "failed",
      message: "The daemon did not answer.",
    });
    rerender({ targets: [target] });

    expect(listNodeExecutions).toHaveBeenCalledTimes(1);
  });

  it("keeps the detail of a node that leaves the list and returns with the same key", async () => {
    const { result, rerender } = renderHook(({ targets }) => useAttentionDetails(targets), {
      initialProps: { targets: [paused("n2")] },
    });
    await waitFor(() => expect(result.current.details.get("n2")).toBeDefined());

    rerender({ targets: [] });
    rerender({ targets: [paused("n2")] });

    expect(listNodeExecutions).toHaveBeenCalledTimes(1);
  });
});
