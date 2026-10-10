import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { discardNode } from "@/api/resources/mission";
import type { MissionControlResult, MissionRunnableNode, NodeState } from "@/api/types";
import { useNodeDiscard } from "./use-node-discard";
import { renderedText } from "../../../../test/text-content";

vi.mock("@/api/resources/mission", () => ({ discardNode: vi.fn() }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const discardMock = vi.mocked(discardNode);

const OBJECTIVE: MissionRunnableNode = {
  id: "node_audit",
  kind: "objective",
  filename: "audit.md",
  mission_id: "mission_1",
  parent_id: "node_team",
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
  state: "Executing",
  attempt: 3,
  priority: 0,
  depends_on: [],
};

function mount(node: MissionRunnableNode = OBJECTIVE, reload = vi.fn()) {
  const view = renderHook(() => useNodeDiscard(node, 7, reload));
  return { ...view, reload };
}

beforeEach(() => {
  discardMock.mockReset().mockResolvedValue({} as MissionControlResult);
});

describe("useNodeDiscard", () => {
  it.each<[NodeState, boolean]>([
    ["Pending", true],
    ["Available", true],
    ["Executing", true],
    ["Waiting", true],
    ["Evaluating", true],
    ["Blocked", true],
    ["Paused", true],
    ["External.Success", true],
    ["External.Failed", true],
    ["External.Requested", false],
    ["Completed", false],
    ["Discarded", false],
  ])("offers discard in the state %s: %s", (state, available) => {
    expect(mount({ ...OBJECTIVE, state }).result.current.available).toBe(available);
  });

  it("offers no discard for a retired node", () => {
    expect(mount({ ...OBJECTIVE, retired_at: 1 }).result.current.available).toBe(false);
  });

  it("requires a nonblank reason before the call", async () => {
    const { result } = mount();

    act(() => result.current.request());
    act(() => result.current.setReason("   "));
    expect(result.current.missing).toBe("Fill Reason to discard.");
    await act(async () => result.current.confirm());

    expect(discardMock).not.toHaveBeenCalled();
    expect(result.current.open).toBe(true);
  });

  it("sends the trimmed reason, the mission version and the expected state and attempt, then reloads", async () => {
    const { result, reload } = mount();

    act(() => result.current.request());
    act(() => result.current.setReason("  Out of scope  "));
    expect(result.current.missing).toBeNull();
    await act(async () => result.current.confirm());

    expect(discardMock).toHaveBeenCalledWith("node_audit", {
      reason: "Out of scope",
      expected_mission_version: 7,
      expected_state: "Executing",
      expected_attempt: 3,
    });
    expect(result.current.open).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("names the closed attempt, the outcome and the lost dependency", () => {
    expect(renderedText(mount().result.current.consequence)).toEqual({
      text: "Discard closes attempt 3 of Audit log, writes an undetermined outcome with the reason and ends the node as Discarded. A discarded node satisfies no dependency, so a node that depends on Audit log cannot start. A discard cannot be undone.",
      bold: ["Audit log", "Audit log"],
    });
    expect(
      renderedText(mount({ ...OBJECTIVE, state: "Blocked" }).result.current.saferPath),
    ).toEqual({
      text: "To run Audit log again instead, keep it and unblock it.",
      bold: ["Audit log"],
    });
  });

  it.each([
    [
      "mission.node.state_conflict",
      "The state or the attempt of the node changed after this read.",
    ],
    ["mission.version.conflict", "The mission changed after this read."],
    ["mission.node.action_unresolved", "The open attempt has a requested external action"],
  ])("maps the conflict %s to a message and reloads", async (code, message) => {
    discardMock.mockRejectedValue(new ApiError("conflict", "Conflict.", 409, code));
    const { result, reload } = mount();

    act(() => result.current.request());
    act(() => result.current.setReason("Out of scope"));
    await act(async () => result.current.confirm());

    expect(result.current.error).toContain(message);
    expect(result.current.open).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
