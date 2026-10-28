import { act, render, renderHook, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { approveProposal } from "@/api/resources/mission";
import type { MissionNodeRecord, MissionProposal, MissionProposalApproveResult } from "@/api/types";
import { useProposalApprove } from "./use-proposal-approve";

vi.mock("@/api/resources/mission", () => ({ approveProposal: vi.fn() }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const approveMock = vi.mocked(approveProposal);

const PROPOSER: MissionNodeRecord = {
  id: "node_team",
  intent: "examine",
  tags: [],
  tasks: [],
  filename: "team.md",
  mission_id: "mission_1",
  visible_revision: 1,
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
    requirement: "Invite links expire after one use.",
    criterion: "A second use of a link fails.",
    task: {
      name: "Expire the link",
      requirement: "Mark the link used.",
      criterion: "The link is marked used.",
      verifications: ["pnpm test"],
    },
  },
  created_node_id: null,
  approved_at: null,
  created_at: 0,
};

const APPROVED: MissionProposalApproveResult = {
  created: {
    mission_version: 8,
    revisions: [],
    retired_node_ids: [],
    added_edges: [{ dependent_id: "node_team", depends_on_id: "node_fix" }],
    removed_edges: [],
    open_attempts_unchanged: [],
  },
  proposer: {
    node: { ...PROPOSER, state: "Pending", attempt: 3 },
    attempt: null,
    outcome: null,
    actor: { kind: "human", account: "ulrich", name: "Ulrich" },
    accepted_at: 1,
  },
};

function mount(proposer = PROPOSER, reload = vi.fn()) {
  const view = renderHook(() => useProposalApprove(proposer, 7, reload));
  return { ...view, reload };
}

beforeEach(() => {
  approveMock.mockReset().mockResolvedValue(APPROVED);
});

describe("useProposalApprove", () => {
  it("offers approve only for an unapproved proposal of the blocked attempt", () => {
    const { result } = mount();

    expect(result.current.canApprove(PROPOSAL)).toBe(true);
    expect(result.current.canApprove({ ...PROPOSAL, approved_at: 1 })).toBe(false);
    expect(result.current.unavailableReason({ ...PROPOSAL, attempt: 1 })).toBe(
      "The proposal belongs to attempt 1. The proposer is blocked after attempt 2.",
    );
  });

  it("names why approve is unavailable when the proposer is not blocked", () => {
    const { result } = mount({ ...PROPOSER, state: "Available" });

    expect(result.current.canApprove(PROPOSAL)).toBe(false);
    expect(result.current.unavailableReason(PROPOSAL)).toBe(
      "The proposer is Available. Approve needs a Blocked proposer.",
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
    const [message, options] = vi.mocked(toast.success).mock.calls.at(-1) ?? [];
    expect(message).toBe("Approved the proposal Fix the invite link.");
    render(options?.description as ReactElement);
    expect(
      screen.getByText(/The proposer is Pending at mission version 8\./, { exact: false }),
    ).toBeTruthy();
  });

  it("omits an empty reason", async () => {
    const { result } = mount();

    act(() => result.current.request(PROPOSAL));
    await act(async () => result.current.confirm());

    expect(approveMock).toHaveBeenCalledWith("proposal_1", { expected_mission_version: 7 });
  });

  it.each([
    ["mission.proposal.already_approved", "Another approve of this proposal came first."],
    ["mission.node.state_conflict", "The proposer is no longer Blocked"],
    ["mission.version.conflict", "The mission changed after this read."],
    [
      "mission.node.tags_unmatched",
      "Add a worker binding whose tags include every tag of this node, then try again.",
    ],
  ])("maps the conflict %s to a message and reloads", async (code, message) => {
    approveMock.mockRejectedValue(new ApiError("conflict", "Conflict.", 409, code));
    const { result, reload } = mount();

    act(() => result.current.request(PROPOSAL));
    await act(async () => result.current.confirm());

    expect(result.current.error).toContain(message);
    expect(toast.error).toHaveBeenCalledWith("Approving the proposal Fix the invite link failed.", {
      description: expect.stringContaining(message),
    });
    expect(result.current.target).toBe(PROPOSAL);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
