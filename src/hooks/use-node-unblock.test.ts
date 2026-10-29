import { act, renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { unblockNode } from "@/api/resources/mission";
import type { MissionControlResult, MissionNodeRecord, MissionProposal } from "@/api/types";
import { useNodeUnblock } from "./use-node-unblock";
import { renderedText } from "../../test/text-content";

vi.mock("@/api/resources/mission", () => ({ unblockNode: vi.fn() }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const unblockMock = vi.mocked(unblockNode);

const EXAMINE: MissionNodeRecord = {
  id: "node_team",
  intent: "examine",
  tags: [],
  tasks: [],
  filename: "team.md",
  mission_id: "mission_1",
  visible_revision: 3,
  content: {
    name: "Team workspaces",
    requirement: "r",
    criterion: "c",
    verifications: ["pnpm test"],
    bindings: [],
    intent: "examine",
    tags: [],
  },
  retired_at: null,
  pinned_by_attempts: [],
  pinned_revision: null,
  state: "Blocked",
  attempt: 2,
  priority: 0,
  depends_on: [],
};

const PROPOSAL: MissionProposal = {
  id: "proposal_1",
  node_id: "node_team",
  attempt: 2,
  assessment_id: "assessment_1",
  content: {
    dependency_id: "node_invite",
    name: "Fix the invite link",
    requirement: "r",
    criterion: "c",
    task: { name: "t", requirement: "r", criterion: "c", verifications: ["v"] },
  },
  created_node_id: null,
  approved_at: null,
  rejected_at: null,
  created_at: 0,
};

function mount(
  node: MissionNodeRecord = EXAMINE,
  proposals: readonly MissionProposal[] = [],
  reload = vi.fn(),
) {
  const view = renderHook(() => useNodeUnblock(node, 7, proposals, reload));
  return { ...view, reload };
}

beforeEach(() => {
  unblockMock.mockReset().mockResolvedValue({} as MissionControlResult);
});

describe("useNodeUnblock", () => {
  it("offers unblock only for a Blocked node that is not retired", () => {
    expect(mount().result.current.available).toBe(true);
    expect(mount({ ...EXAMINE, state: "Available" }).result.current.available).toBe(false);
    expect(mount({ ...EXAMINE, retired_at: 1 }).result.current.available).toBe(false);
  });

  it("opens no dialog for a node that is not Blocked", () => {
    const { result } = mount({ ...EXAMINE, state: "Paused" });

    act(() => result.current.request());
    expect(result.current.open).toBe(false);
  });

  it("sends the blocked attempt, the revision, the mission version and the trimmed reason, then reloads", async () => {
    const { result, reload } = mount();

    act(() => result.current.request());
    act(() => result.current.setReason("  Retry with the new key  "));
    await act(async () => result.current.confirm());

    expect(unblockMock).toHaveBeenCalledWith("node_team", {
      blocked_attempt: 2,
      expected_revision: 3,
      expected_mission_version: 7,
      reason: "Retry with the new key",
    });
    expect(result.current.open).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("omits a blank reason", async () => {
    const { result } = mount();

    act(() => result.current.request());
    act(() => result.current.setReason("   "));
    await act(async () => result.current.confirm());

    expect(unblockMock).toHaveBeenCalledWith("node_team", {
      blocked_attempt: 2,
      expected_revision: 3,
      expected_mission_version: 7,
    });
  });

  it("offers the start point choice only for an implement node with an attempt", () => {
    expect(mount().result.current.startChoice).toBe(false);
    expect(mount({ ...EXAMINE, intent: "implement" }).result.current.startChoice).toBe(true);
    expect(mount({ ...EXAMINE, intent: "implement", attempt: 0 }).result.current.startChoice).toBe(
      false,
    );
  });

  it("sends start_point base_branch for an implement node when the human chooses it", async () => {
    const { result } = mount({ ...EXAMINE, intent: "implement" });

    act(() => result.current.request());
    act(() => result.current.setFromBase(true));
    await act(async () => result.current.confirm());

    expect(unblockMock).toHaveBeenCalledWith("node_team", {
      blocked_attempt: 2,
      expected_revision: 3,
      expected_mission_version: 7,
      start_point: "base_branch",
    });
  });

  it("sends no start_point for an examine node", async () => {
    const { result } = mount();

    act(() => result.current.request());
    act(() => result.current.setFromBase(true));
    await act(async () => result.current.confirm());

    expect(unblockMock).toHaveBeenCalledWith("node_team", {
      blocked_attempt: 2,
      expected_revision: 3,
      expected_mission_version: 7,
    });
  });

  it("names the open proposals of the blocked attempt that an unblock rejects", () => {
    const { result } = mount(EXAMINE, [
      PROPOSAL,
      {
        ...PROPOSAL,
        id: "proposal_old",
        attempt: 1,
        content: { ...PROPOSAL.content, name: "Old" },
      },
      {
        ...PROPOSAL,
        id: "proposal_done",
        approved_at: 1,
        content: { ...PROPOSAL.content, name: "Done" },
      },
    ]);

    expect(renderedText(result.current.proposalNotice)).toEqual({
      text: "Unblock rejects the open proposals: Fix the invite link. They stay recorded, but the examine node runs the next attempt without the fix node.",
      bold: ["Fix the invite link"],
    });
    expect(renderedText(result.current.consequence)).toEqual({
      text: "Unblock opens attempt 3 of Team workspaces at revision 3 and makes the node Available.",
      bold: ["Team workspaces"],
    });
  });

  it("states no proposal notice without an open proposal", () => {
    expect(mount(EXAMINE, [{ ...PROPOSAL, approved_at: 1 }]).result.current.proposalNotice).toBe(
      null,
    );
  });

  it.each([
    ["mission.node.state_conflict", "The node is no longer Blocked at this attempt."],
    ["mission.revision.conflict", "The content of the node changed after this read."],
    ["mission.version.conflict", "The mission changed after this read."],
    ["mission.node.control_refused", "The node is no longer Blocked."],
    [
      "mission.node.tags_unmatched",
      "No worker binding of the project matches the tags of this node.",
    ],
    ["mission.node.intent_locked", "The node opened an attempt, so its intent cannot change."],
  ])("maps the conflict %s to a message and reloads", async (code, message) => {
    unblockMock.mockRejectedValue(new ApiError("conflict", "Conflict.", 409, code));
    const { result, reload } = mount();

    act(() => result.current.request());
    await act(async () => result.current.confirm());

    expect(result.current.error).toContain(message);
    expect(toast.error).toHaveBeenCalledWith("Unblocking Team workspaces failed.", {
      description: expect.stringContaining(message),
    });
    expect(result.current.open).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
