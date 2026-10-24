import { act, renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { pauseNode } from "@/api/resources/mission";
import type { MissionControlResult, MissionNodeRecord, NodeState } from "@/api/types";
import { useNodePause } from "./use-node-pause";
import { renderedText } from "../../test/text-content";

vi.mock("@/api/resources/mission", () => ({ pauseNode: vi.fn() }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const pauseMock = vi.mocked(pauseNode);

const IMPLEMENT: MissionNodeRecord = {
  id: "node_audit",
  intent: "implement",
  tags: [],
  tasks: [],
  filename: "audit.md",
  mission_id: "mission_1",
  visible_revision: 2,
  content: {
    name: "Audit log",
    requirement: "r",
    criterion: "c",
    verifications: ["pnpm test"],
    bindings: [],
    intent: "implement",
    tags: [],
  },
  retired_at: null,
  pinned_by_attempts: [],
  pinned_revision: null,
  state: "Executing",
  attempt: 3,
  priority: 0,
  depends_on: [],
};

function mount(node: MissionNodeRecord = IMPLEMENT, reload = vi.fn()) {
  const view = renderHook(() => useNodePause(node, 7, reload));
  return { ...view, reload };
}

beforeEach(() => {
  pauseMock.mockReset().mockResolvedValue({} as MissionControlResult);
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
});

describe("useNodePause", () => {
  it.each<[NodeState, boolean]>([
    ["Pending", true],
    ["Available", true],
    ["Executing", true],
    ["Waiting", true],
    ["Evaluating", true],
    ["External.Requested", true],
    ["External.Success", true],
    ["External.Failed", true],
    ["Blocked", false],
    ["Paused", false],
    ["Completed", false],
    ["Discarded", false],
  ])("offers pause in the state %s: %s", (state, available) => {
    expect(mount({ ...IMPLEMENT, state }).result.current.available).toBe(available);
  });

  it("offers no pause for a retired node", () => {
    expect(mount({ ...IMPLEMENT, retired_at: 1 }).result.current.available).toBe(false);
  });

  it("sends no call for a node that admits no pause", async () => {
    const { result } = mount({ ...IMPLEMENT, state: "Blocked" });

    act(() => result.current.request());

    expect(result.current.open).toBe(false);
    await act(async () => result.current.confirm());
    expect(pauseMock).not.toHaveBeenCalled();
  });

  it("requires a nonblank reason before the call", async () => {
    const { result } = mount();

    act(() => result.current.request());
    act(() => result.current.setReason("   "));
    expect(result.current.missing).toBe("Fill Reason to pause.");
    await act(async () => result.current.confirm());

    expect(pauseMock).not.toHaveBeenCalled();
    expect(result.current.open).toBe(true);
  });

  it("sends the trimmed reason, the mission version and the expected state and attempt, then reloads", async () => {
    const { result, reload } = mount();

    act(() => result.current.request());
    act(() => result.current.setReason("  Hold for review  "));
    expect(result.current.missing).toBeNull();
    await act(async () => result.current.confirm());

    expect(pauseMock).toHaveBeenCalledWith("node_audit", {
      reason: "Hold for review",
      expected_mission_version: 7,
      expected_state: "Executing",
      expected_attempt: 3,
    });
    expect(toast.success).toHaveBeenCalledWith("Paused Audit log.", expect.anything());
    expect(result.current.open).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("names the live claim for an Executing node and the safer path", () => {
    const { result } = mount();

    expect(renderedText(result.current.consequence)).toEqual({
      text: "Pause ends the live claim on Audit log and holds the node as Paused. The worker stops its execution. The node runs no work until you resume it.",
      bold: ["Audit log"],
    });
    expect(renderedText(result.current.saferPath)).toEqual({
      text: "To keep Audit log as it is, cancel. The node stays Executing.",
      bold: ["Audit log"],
    });
  });

  it("names no live claim for a Waiting node", () => {
    const { result } = mount({ ...IMPLEMENT, state: "Waiting" });

    expect(renderedText(result.current.consequence)).toEqual({
      text: "Pause holds Audit log as Paused. The node runs no work until you resume it.",
      bold: ["Audit log"],
    });
  });

  it.each([
    [
      "mission.node.state_conflict",
      "The state or the attempt of the node changed after this read.",
    ],
    ["mission.version.conflict", "The mission changed after this read."],
    ["mission.node.control_refused", "The node is in a state that admits no pause."],
  ])("maps the conflict %s to a message and reloads", async (code, message) => {
    pauseMock.mockRejectedValue(new ApiError("conflict", "Conflict.", 409, code));
    const { result, reload } = mount();

    act(() => result.current.request());
    act(() => result.current.setReason("Hold for review"));
    await act(async () => result.current.confirm());

    expect(result.current.error).toContain(message);
    expect(toast.error).toHaveBeenCalledWith("Pausing Audit log failed.", {
      description: expect.stringContaining(message),
    });
    expect(result.current.open).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
