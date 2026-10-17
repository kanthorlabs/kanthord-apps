import { act, renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { discardNode } from "@/api/resources/mission";
import type {
  MissionControlResult,
  MissionExternalAction,
  MissionNodeRecord,
  NodeState,
} from "@/api/types";
import { useNodeDiscard } from "./use-node-discard";
import { renderedText } from "../../test/text-content";

vi.mock("@/api/resources/mission", () => ({ discardNode: vi.fn() }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const discardMock = vi.mocked(discardNode);

const IMPLEMENT: MissionNodeRecord = {
  id: "node_audit",
  work: "implement",
  requires: [],
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
    work: "implement",
    requires: [],
  },
  retired_at: null,
  pinned_by_attempts: [],
  state: "Executing",
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
      configuration: { base_branch: "main", landing: "human" },
    },
    requested: resolution !== "unrequested",
    request_evidence_id: resolution === "unrequested" ? null : "evidence_1",
    resolution,
  };
}

function mount(
  node: MissionNodeRecord = IMPLEMENT,
  reload = vi.fn(),
  actions: readonly MissionExternalAction[] | null = [],
) {
  const view = renderHook(() => useNodeDiscard(node, 7, actions, reload));
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
    expect(mount({ ...IMPLEMENT, state }).result.current.available).toBe(available);
  });

  it("holds discard of a Paused node until the external actions answer", () => {
    expect(mount({ ...IMPLEMENT, state: "Paused" }, vi.fn(), null).result.current.available).toBe(
      false,
    );
  });

  it.each<[MissionExternalAction["resolution"], boolean]>([
    ["unrequested", true],
    ["expected-end", true],
    ["other-end", true],
    ["unresolved", false],
  ])("offers discard of a Paused node with a request that is %s: %s", (resolution, available) => {
    const { result } = mount({ ...IMPLEMENT, state: "Paused" }, vi.fn(), [action(resolution)]);

    expect(result.current.available).toBe(available);
  });

  it("sends no call for a Paused node with an unresolved request", async () => {
    const { result } = mount({ ...IMPLEMENT, state: "Paused" }, vi.fn(), [action("unresolved")]);

    act(() => result.current.request());

    expect(result.current.open).toBe(false);
    await act(async () => result.current.confirm());
    expect(discardMock).not.toHaveBeenCalled();
  });

  it("offers no discard for a retired node", () => {
    expect(mount({ ...IMPLEMENT, retired_at: 1 }).result.current.available).toBe(false);
  });

  it.each<NodeState>(["Pending", "Available", "Executing", "Waiting", "External.Success"])(
    "holds discard of a %s node with an open attempt until the actions answer and clear",
    (state) => {
      const node = { ...IMPLEMENT, state };

      expect(mount(node, vi.fn(), null).result.current.available).toBe(false);
      expect(mount(node, vi.fn(), [action("unresolved")]).result.current.available).toBe(false);
      expect(mount(node, vi.fn(), [action("expected-end")]).result.current.available).toBe(true);
    },
  );

  it("needs no external action read for a Blocked node or a node at attempt 0", () => {
    expect(mount({ ...IMPLEMENT, state: "Blocked" }, vi.fn(), null).result.current.available).toBe(
      true,
    );
    expect(
      mount({ ...IMPLEMENT, state: "Pending", attempt: 0 }, vi.fn(), null).result.current.available,
    ).toBe(true);
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
      renderedText(mount({ ...IMPLEMENT, state: "Blocked" }).result.current.saferPath),
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
    expect(toast.error).toHaveBeenCalledWith("Discarding Audit log failed.", {
      description: expect.stringContaining(message),
    });
    expect(result.current.open).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
