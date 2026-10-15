import { act, renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { checkNode } from "@/api/resources/mission";
import type {
  MissionExternalAction,
  MissionNodeCheckAnswer,
  MissionNodeCheckResult,
  MissionRunnableNode,
  NodeState,
} from "@/api/types";

import { useNodeCheck } from "./use-node-check";

vi.mock("@/api/resources/mission", () => ({ checkNode: vi.fn() }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const checkMock = vi.mocked(checkNode);

function nodeIn(state: NodeState): MissionRunnableNode {
  return {
    id: "node_webhook",
    kind: "objective",
    filename: "webhook.md",
    mission_id: "mission_1",
    parent_id: null,
    visible_revision: 1,
    content: {
      name: "Stripe webhook",
      requirement: "r",
      criterion: "c",
      verifications: [],
      bindings: [],
    },
    retired_at: null,
    pinned_by_attempts: [],
    state,
    attempt: 1,
    priority: 0,
    depends_on: [],
  };
}

function action(resolution: MissionExternalAction["resolution"]): MissionExternalAction {
  return {
    node_id: "node_webhook",
    attempt: 1,
    action: {
      key: "repo.pull_request",
      binding_id: "binding_1",
      action: "pull_request",
      expected_end_state: "pull_request_merged",
      follows: null,
      configuration: { base_branch: "main" },
    },
    requested: resolution !== "unrequested",
    request_evidence_id: resolution === "unrequested" ? null : "evidence_1",
    resolution,
  };
}

function answer(
  results: readonly MissionNodeCheckResult[],
  failures: MissionNodeCheckAnswer["failures"] = [],
): MissionNodeCheckAnswer {
  return { results, failures };
}

const MERGED: MissionNodeCheckResult = {
  evidence_id: "evidence_1",
  requirement_key: "repo.pull_request",
  resolution: "expected-end",
};

function mount(
  state: NodeState = "External.Requested",
  actions: readonly MissionExternalAction[] | null = [action("unresolved")],
) {
  const reload = vi.fn();
  const markActed = vi.fn();
  const view = renderHook(() => useNodeCheck(nodeIn(state), 7, actions, reload, markActed));
  return { ...view, reload, markActed };
}

beforeEach(() => {
  checkMock.mockReset();
  vi.mocked(toast.error).mockReset();
});

describe("useNodeCheck", () => {
  it.each<[NodeState, boolean]>([
    ["External.Requested", true],
    ["Paused", true],
    ["Blocked", false],
    ["Waiting", false],
  ])("answers available %s -> %s while a request is unresolved", (state, expected) => {
    expect(mount(state).result.current.available).toBe(expected);
  });

  it("is unavailable until the actions are read and when no request is unresolved", () => {
    expect(mount("External.Requested", null).result.current.available).toBe(false);
    expect(mount("External.Requested", [action("expected-end")]).result.current.available).toBe(
      false,
    );
  });

  it("sends only the expected mission version and shows Checking, then the combined result", async () => {
    let settle: (value: MissionNodeCheckAnswer) => void = () => undefined;
    checkMock.mockReturnValue(new Promise((resolve) => (settle = resolve)));
    const { result, reload, markActed } = mount();

    act(() => result.current.check());

    expect(checkMock).toHaveBeenCalledWith("node_webhook", { expected_mission_version: 7 });
    expect(result.current.label).toBe("Checking");
    expect(result.current.checking).toBe(true);

    await act(async () => settle(answer([MERGED])));

    expect(result.current.label).toBe("Merged");
    expect(result.current.checking).toBe(false);
    expect(markActed).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("starts no second check while one runs", () => {
    checkMock.mockReturnValue(new Promise(() => undefined));
    const { result } = mount();

    act(() => result.current.check());
    act(() => result.current.check());

    expect(checkMock).toHaveBeenCalledTimes(1);
  });

  it("shows one toast with Retry for each failure inside the answer", async () => {
    const failure = (evidence: string, message: string) => ({
      evidence_id: evidence,
      error: {
        error: { code: "mission.node.claim_live", message, details: null },
        request_id: "r",
      },
    });
    checkMock.mockResolvedValue(
      answer(
        [MERGED],
        [failure("evidence_2", "First failed."), failure("evidence_3", "Second failed.")],
      ),
    );
    const { result } = mount();

    await act(async () => result.current.check());

    const calls = vi.mocked(toast.error).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0]?.[1]).toMatchObject({
      description: "First failed. (mission.node.claim_live)",
      action: { label: "Retry" },
    });
    expect(calls[1]?.[1]).toMatchObject({
      description: "Second failed. (mission.node.claim_live)",
    });
  });

  it("runs the check again from the Retry action of a failure toast", async () => {
    checkMock.mockResolvedValue(
      answer(
        [],
        [
          {
            evidence_id: "evidence_2",
            error: {
              error: { code: "system.operation.unknown", message: "Unknown.", details: null },
              request_id: "r",
            },
          },
        ],
      ),
    );
    const { result } = mount();
    await act(async () => result.current.check());
    const retry = vi.mocked(toast.error).mock.calls[0]?.[1]?.action as unknown as {
      onClick: () => void;
    };

    await act(async () => retry.onClick());

    expect(checkMock).toHaveBeenCalledTimes(2);
  });

  it("names the conflict message and reads again on a stale mission version", async () => {
    checkMock.mockRejectedValue(
      new ApiError("conflict", "Stale.", 409, "mission.version.conflict"),
    );
    const { result, reload } = mount();

    await act(async () => result.current.check());

    expect(toast.error).toHaveBeenCalledWith(
      "The mission changed after this read. The view now shows the current mission. Check again.",
    );
    expect(reload).toHaveBeenCalledTimes(1);
    expect(result.current.label).toBeNull();
  });

  it("shows a toast with Retry when the call fails without a conflict", async () => {
    checkMock.mockRejectedValue(new ApiError("unreachable", "No answer.", 0));
    const { result } = mount();

    await act(async () => result.current.check());

    expect(toast.error).toHaveBeenCalledWith("Checking Stripe webhook failed.", {
      description: "No answer.",
      action: { label: "Retry", onClick: expect.any(Function) },
    });
  });
});
