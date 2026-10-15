import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { removeDependency } from "@/api/resources/mission";
import type { MissionNodeChange, MissionRunnableNode, NodeState } from "@/api/types";
import { useDependencyRemove } from "./use-dependency-remove";
import { renderedText } from "../../../test/text-content";

vi.mock("@/api/resources/mission", () => ({ removeDependency: vi.fn() }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const removeMock = vi.mocked(removeDependency);

const NODE: MissionRunnableNode = {
  id: "node_links",
  kind: "objective",
  filename: "links.md",
  mission_id: "mission_1",
  parent_id: null,
  visible_revision: 1,
  content: {
    name: "Redirect the links",
    requirement: "",
    criterion: "",
    verifications: [],
    bindings: [],
  },
  retired_at: null,
  pinned_by_attempts: [],
  state: "Pending",
  attempt: 0,
  priority: 0,
  depends_on: ["node_drop"],
};

const DROPPED = { id: "node_drop", name: "Drop the legacy checkout" };

function mount(node: MissionRunnableNode = NODE, reload = vi.fn()) {
  const view = renderHook(() => useDependencyRemove(node, 7, reload));
  return { ...view, reload };
}

beforeEach(() => {
  removeMock.mockReset().mockResolvedValue({} as MissionNodeChange);
});

describe("useDependencyRemove", () => {
  it.each<[NodeState, boolean]>([
    ["Pending", true],
    ["Available", true],
    ["Blocked", true],
    ["Paused", true],
    ["Completed", false],
    ["Discarded", false],
  ])("offers the removal for a dependent in the state %s: %s", (state, available) => {
    expect(mount({ ...NODE, state }).result.current.available).toBe(available);
  });

  it("offers no removal for a retired dependent", () => {
    expect(mount({ ...NODE, retired_at: 1 }).result.current.available).toBe(false);
  });

  it("opens no dialog for a terminal dependent", () => {
    const { result } = mount({ ...NODE, state: "Discarded" });

    act(() => result.current.request(DROPPED));

    expect(result.current.target).toBeNull();
  });

  it("requires a nonblank reason before the call", async () => {
    const { result } = mount();

    act(() => result.current.request(DROPPED));
    act(() => result.current.setReason("  "));
    expect(result.current.missing).toBe("Fill Reason to remove the dependency.");
    await act(async () => result.current.confirm());

    expect(removeMock).not.toHaveBeenCalled();
  });

  it("deletes the edge with the reason and the mission version, then reloads", async () => {
    const { result, reload } = mount();

    act(() => result.current.request(DROPPED));
    act(() => result.current.setReason("  The checkout is gone  "));
    await act(async () => result.current.confirm());

    expect(removeMock).toHaveBeenCalledWith("node_links", "node_drop", {
      reason: "The checkout is gone",
      expected_mission_version: 7,
    });
    expect(result.current.target).toBeNull();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("names the edge, the effect and the safer path", () => {
    const { result } = mount();
    act(() => result.current.request(DROPPED));

    expect(renderedText(result.current.consequence)).toEqual({
      text: "Remove dependency deletes the edge from Redirect the links to Drop the legacy checkout. Redirect the links can start when its other dependencies are Completed. The edit changes the mission version.",
      bold: ["Redirect the links", "Drop the legacy checkout", "Redirect the links"],
    });
    expect(renderedText(result.current.saferPath)).toEqual({
      text: "To end Redirect the links instead, discard it.",
      bold: ["Redirect the links"],
    });
  });

  it.each([
    ["mission.version.conflict", "The mission changed after this read."],
    ["mission.node.retired", "The node is retired."],
    ["mission.node.terminal", "The node is terminal."],
  ])("maps the conflict %s to a message and reloads", async (code, message) => {
    removeMock.mockRejectedValue(new ApiError("conflict", "Conflict.", 409, code));
    const { result, reload } = mount();

    act(() => result.current.request(DROPPED));
    act(() => result.current.setReason("Gone"));
    await act(async () => result.current.confirm());

    expect(result.current.error).toContain(message);
    expect(result.current.target).toEqual(DROPPED);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
