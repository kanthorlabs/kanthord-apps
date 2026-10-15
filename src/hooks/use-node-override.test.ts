import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { overrideNode } from "@/api/resources/mission";
import type {
  MissionControlResult,
  MissionExternalAction,
  MissionRunnableNode,
  NodeState,
} from "@/api/types";
import { useNodeOverride } from "./use-node-override";
import { renderedText } from "../../test/text-content";

vi.mock("@/api/resources/mission", () => ({ overrideNode: vi.fn() }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const overrideMock = vi.mocked(overrideNode);

const NODE: MissionRunnableNode = {
  id: "node_audit",
  kind: "objective",
  filename: "audit.md",
  mission_id: "mission_1",
  parent_id: null,
  visible_revision: 2,
  content: {
    name: "Audit log",
    requirement: "r",
    criterion: "c",
    verifications: ["pnpm test"],
    bindings: [],
  },
  retired_at: null,
  pinned_by_attempts: [],
  state: "Blocked",
  attempt: 3,
  priority: 0,
  depends_on: [],
};

function action(resolution: MissionExternalAction["resolution"]): MissionExternalAction {
  return {
    node_id: "node_audit",
    attempt: 3,
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

function mount(
  node: MissionRunnableNode = NODE,
  reload = vi.fn(),
  actions: readonly MissionExternalAction[] | null = [],
) {
  const view = renderHook(() => useNodeOverride(node, 7, reload, actions));
  return { ...view, reload };
}

beforeEach(() => {
  overrideMock.mockReset().mockResolvedValue({} as MissionControlResult);
});

describe("useNodeOverride", () => {
  it.each<[NodeState, boolean]>([
    ["Pending", true],
    ["Available", true],
    ["Executing", true],
    ["Waiting", true],
    ["Evaluating", false],
    ["Blocked", true],
    ["Paused", true],
    ["External.Success", true],
    ["External.Failed", true],
    ["External.Requested", false],
    ["Completed", false],
    ["Discarded", false],
  ])("offers override in the state %s: %s", (state, available) => {
    expect(mount({ ...NODE, state }).result.current.available).toBe(available);
  });

  it("offers no override for a retired node", () => {
    expect(mount({ ...NODE, retired_at: 1 }).result.current.available).toBe(false);
  });

  it("holds override of a Paused node until the external actions answer", () => {
    expect(mount({ ...NODE, state: "Paused" }, vi.fn(), null).result.current.available).toBe(false);
  });

  it.each<[MissionExternalAction["resolution"], boolean]>([
    ["unrequested", true],
    ["expected-end", true],
    ["other-end", true],
    ["unresolved", false],
  ])("offers override of a Paused node with a request that is %s: %s", (resolution, available) => {
    expect(
      mount({ ...NODE, state: "Paused" }, vi.fn(), [action(resolution)]).result.current.available,
    ).toBe(available);
  });

  it("sends no call for a Paused node with an unresolved request", async () => {
    const { result } = mount({ ...NODE, state: "Paused" }, vi.fn(), [action("unresolved")]);

    act(() => result.current.request());
    await act(async () => result.current.confirm());

    expect(result.current.open).toBe(false);
    expect(overrideMock).not.toHaveBeenCalled();
  });

  it("requires a nonblank reason before the call", async () => {
    const { result } = mount();

    act(() => result.current.request());
    act(() => result.current.setReason("   "));
    expect(result.current.missing).toBe("Fill Reason to override.");
    await act(async () => result.current.confirm());

    expect(overrideMock).not.toHaveBeenCalled();
    expect(result.current.open).toBe(true);
  });

  it("sends the result success with the expected state and attempt, then reloads", async () => {
    const { result, reload } = mount();

    act(() => result.current.request());
    act(() => result.current.setReason("  Verified by hand  "));
    await act(async () => result.current.confirm());

    expect(overrideMock).toHaveBeenCalledWith("node_audit", {
      reason: "Verified by hand",
      expected_mission_version: 7,
      expected_state: "Blocked",
      expected_attempt: 3,
      result: "success",
    });
    expect(result.current.open).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("names the outcome, the authority, the effect and the point of no return", () => {
    expect(renderedText(mount().result.current.consequence)).toEqual({
      text: "Override records a success outcome for Audit log on your authority and ends it as Completed. Nodes that depend on it can start. No commit is recorded. An override cannot be undone.",
      bold: ["Audit log"],
    });
  });

  it.each<[NodeState, string]>([
    ["Blocked", "To run it again, unblock it."],
    ["Paused", "To continue the work, resume it."],
    ["Available", "To keep Audit log, cancel. The node stays Available."],
  ])("names the safer path for a %s node", (state, text) => {
    expect(renderedText(mount({ ...NODE, state }, vi.fn(), []).result.current.saferPath).text).toBe(
      text,
    );
  });

  it.each([
    [
      "mission.node.state_conflict",
      "The state or the attempt of the node changed after this read.",
    ],
    ["mission.node.control_refused", "The node is in a state that admits no override."],
    ["mission.node.action_unresolved", "The open attempt has a requested external action"],
    ["mission.version.conflict", "The mission changed after this read."],
    ["mission.node.retired", "The node is retired."],
    ["mission.node.terminal", "The node is terminal."],
  ])("maps the conflict %s to a message and reloads", async (code, message) => {
    overrideMock.mockRejectedValue(new ApiError("conflict", "Conflict.", 409, code));
    const { result, reload } = mount();

    act(() => result.current.request());
    act(() => result.current.setReason("Verified"));
    await act(async () => result.current.confirm());

    expect(result.current.error).toContain(message);
    expect(result.current.open).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
