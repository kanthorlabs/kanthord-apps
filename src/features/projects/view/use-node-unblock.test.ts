import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { unblockNode } from "@/api/resources/mission";
import type { MissionControlResult, MissionProposal, MissionRunnableNode } from "@/api/types";
import { useNodeUnblock } from "./use-node-unblock";

vi.mock("@/api/resources/mission", () => ({ unblockNode: vi.fn() }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const unblockMock = vi.mocked(unblockNode);

const INITIATIVE: MissionRunnableNode = {
  id: "node_team",
  kind: "initiative",
  filename: "team.md",
  mission_id: "mission_1",
  parent_id: null,
  visible_revision: 3,
  content: {
    name: "Team workspaces",
    requirement: "r",
    criterion: "c",
    verifications: ["pnpm test"],
    bindings: [],
  },
  retired_at: null,
  pinned_by_attempts: [],
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
    objective_id: "node_invite",
    name: "Fix the invite link",
    requirement: "r",
    criterion: "c",
    task: { name: "t", requirement: "r", criterion: "c", verifications: ["v"] },
  },
  objective_node_id: null,
  approved_at: null,
  created_at: 0,
};

function mount(
  node: MissionRunnableNode = INITIATIVE,
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
    expect(mount({ ...INITIATIVE, state: "Available" }).result.current.available).toBe(false);
    expect(mount({ ...INITIATIVE, retired_at: 1 }).result.current.available).toBe(false);
  });

  it("opens no dialog for a node that is not Blocked", () => {
    const { result } = mount({ ...INITIATIVE, state: "Paused" });

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

  it("names the open proposals of the blocked attempt that an unblock rejects", () => {
    const { result } = mount(INITIATIVE, [
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

    expect(result.current.proposalNotice).toBe(
      "Unblock rejects the open proposals: Fix the invite link. They stay recorded, but the initiative runs the next attempt without the fix objective.",
    );
    expect(result.current.consequence).toBe(
      "Unblock opens attempt 3 of Team workspaces at revision 3 and makes the node Available.",
    );
  });

  it("states no proposal notice without an open proposal", () => {
    expect(mount(INITIATIVE, [{ ...PROPOSAL, approved_at: 1 }]).result.current.proposalNotice).toBe(
      null,
    );
  });

  it.each([
    ["mission.node.state_conflict", "The node is no longer Blocked at this attempt."],
    ["mission.revision.conflict", "The content of the node changed after this read."],
    ["mission.version.conflict", "The mission changed after this read."],
    ["mission.node.control_refused", "The node is no longer Blocked."],
  ])("maps the conflict %s to a message and reloads", async (code, message) => {
    unblockMock.mockRejectedValue(new ApiError("conflict", "Conflict.", 409, code));
    const { result, reload } = mount();

    act(() => result.current.request());
    await act(async () => result.current.confirm());

    expect(result.current.error).toContain(message);
    expect(result.current.open).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
