import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { approveProposal } from "@/api/resources/mission";
import type {
  MissionProposal,
  MissionProposalApproveResult,
  MissionRunnableNode,
} from "@/api/types";
import { useProposalApprove } from "./use-proposal-approve";

vi.mock("@/api/resources/mission", () => ({ approveProposal: vi.fn() }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const approveMock = vi.mocked(approveProposal);

const INITIATIVE: MissionRunnableNode = {
  id: "node_team",
  kind: "initiative",
  filename: "team.md",
  mission_id: "mission_1",
  parent_id: null,
  visible_revision: 1,
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
    requirement: "Invite links expire after one use.",
    criterion: "A second use of a link fails.",
    task: {
      name: "Expire the link",
      requirement: "Mark the link used.",
      criterion: "The link is marked used.",
      verifications: ["pnpm test"],
    },
  },
  objective_node_id: null,
  approved_at: null,
  created_at: 0,
};

function mount(initiative = INITIATIVE, reload = vi.fn()) {
  const view = renderHook(() => useProposalApprove(initiative, 7, reload));
  return { ...view, reload };
}

beforeEach(() => {
  approveMock.mockReset().mockResolvedValue({} as MissionProposalApproveResult);
});

describe("useProposalApprove", () => {
  it("offers approve only for an unapproved proposal of the blocked attempt", () => {
    const { result } = mount();

    expect(result.current.canApprove(PROPOSAL)).toBe(true);
    expect(result.current.canApprove({ ...PROPOSAL, approved_at: 1 })).toBe(false);
    expect(result.current.unavailableReason({ ...PROPOSAL, attempt: 1 })).toBe(
      "The proposal belongs to attempt 1. The initiative is blocked after attempt 2.",
    );
  });

  it("names why approve is unavailable when the initiative is not blocked", () => {
    const { result } = mount({ ...INITIATIVE, state: "Available" });

    expect(result.current.canApprove(PROPOSAL)).toBe(false);
    expect(result.current.unavailableReason(PROPOSAL)).toBe(
      "The initiative is Available. Approve needs a Blocked initiative.",
    );
    act(() => result.current.request(PROPOSAL));
    expect(result.current.target).toBeNull();
  });

  it("sends the mission version and the trimmed reason, then reloads", async () => {
    const { result, reload } = mount();

    act(() => result.current.request(PROPOSAL));
    act(() => result.current.setReason("  Fix the defect  "));
    await act(async () => result.current.confirm());

    expect(approveMock).toHaveBeenCalledWith("proposal_1", {
      expected_mission_version: 7,
      reason: "Fix the defect",
    });
    expect(result.current.target).toBeNull();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("omits an empty reason", async () => {
    const { result } = mount();

    act(() => result.current.request(PROPOSAL));
    await act(async () => result.current.confirm());

    expect(approveMock).toHaveBeenCalledWith("proposal_1", { expected_mission_version: 7 });
  });

  it.each([
    ["mission.proposal.already_approved", "Another approve of this proposal came first."],
    ["mission.node.state_conflict", "The initiative is no longer Blocked"],
    ["mission.version.conflict", "The mission changed after this read."],
  ])("maps the conflict %s to a message and reloads", async (code, message) => {
    approveMock.mockRejectedValue(new ApiError("conflict", "Conflict.", 409, code));
    const { result, reload } = mount();

    act(() => result.current.request(PROPOSAL));
    await act(async () => result.current.confirm());

    expect(result.current.error).toContain(message);
    expect(result.current.target).toBe(PROPOSAL);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
