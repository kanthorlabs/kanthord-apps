import { act, renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { decideProposals } from "@/api/resources/mission";
import type { MissionNodeRecord, MissionProposal, MissionProposalDecideResult } from "@/api/types";
import { useProposalDecision } from "./use-proposal-decision";

vi.mock("@/api/resources/mission", () => ({ decideProposals: vi.fn() }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const decideMock = vi.mocked(decideProposals);

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

const FIRST: MissionProposal = {
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
  rejected_at: null,
  created_at: 0,
};

const SECOND: MissionProposal = {
  ...FIRST,
  id: "proposal_2",
  content: { ...FIRST.content, name: "Fix the invite resend" },
};

const THIRD: MissionProposal = {
  ...FIRST,
  id: "proposal_3",
  content: { ...FIRST.content, name: "Fix the invite domain" },
};

const PROPOSALS = [FIRST, SECOND, THIRD];

const CHANGE = {
  revisions: [],
  retired_node_ids: [],
  added_edges: [],
  removed_edges: [],
  open_attempts_unchanged: [],
};

const DECIDED: MissionProposalDecideResult = {
  created: [
    { ...CHANGE, mission_version: 8 },
    { ...CHANGE, mission_version: 9 },
  ],
  rejected_proposal_ids: ["proposal_2"],
  proposer: {
    node: { ...PROPOSER, state: "Pending", attempt: 3 },
    attempt: null,
    outcome: null,
    actor: { kind: "human", account: "ulrich", name: "Ulrich" },
    accepted_at: 1,
  },
};

function mount(
  proposer = PROPOSER,
  proposals: readonly MissionProposal[] = PROPOSALS,
  reload = vi.fn(),
) {
  const view = renderHook(() => useProposalDecision(proposer, proposals, 7, reload));
  return { ...view, reload };
}

beforeEach(() => {
  decideMock.mockReset().mockResolvedValue(DECIDED);
});

describe("useProposalDecision", () => {
  it("offers the decision for the open proposals of the blocked attempt", () => {
    const { result } = mount(PROPOSER, [
      FIRST,
      { ...SECOND, approved_at: 1 },
      { ...THIRD, rejected_at: 1 },
      { ...THIRD, id: "proposal_4", attempt: 1 },
    ]);

    expect(result.current.openProposals).toEqual([FIRST]);
    expect(result.current.available).toBe(true);
    expect(result.current.unavailableReason).toBeNull();
  });

  it.each([
    ["is not blocked", { ...PROPOSER, state: "Available" as const }, PROPOSALS],
    ["is retired", { ...PROPOSER, retired_at: 5 }, PROPOSALS],
    ["holds no open proposal", PROPOSER, [{ ...FIRST, approved_at: 1 }]],
  ])("offers no decision when the proposer %s", (_name, proposer, proposals) => {
    const { result } = mount(proposer, proposals);

    expect(result.current.available).toBe(false);
    act(() => result.current.request());
    expect(result.current.open).toBe(false);
  });

  it("names why the decision is unavailable", () => {
    expect(mount({ ...PROPOSER, state: "Available" }).result.current.unavailableReason).toBe(
      "The proposer is Available. Decide needs a Blocked proposer.",
    );
    expect(mount({ ...PROPOSER, retired_at: 5 }).result.current.unavailableReason).toBe(
      "The proposer is retired. Decide needs an active proposer.",
    );
  });

  it("sends the checked identities in the order of the open proposals and the trimmed reason", async () => {
    const { result, reload } = mount();

    act(() => result.current.request());
    act(() => result.current.toggle("proposal_3"));
    act(() => result.current.toggle("proposal_1"));
    act(() => result.current.setReason("  Fix the defect  "));
    await act(async () => result.current.confirm());

    expect(decideMock).toHaveBeenCalledTimes(1);
    expect(decideMock).toHaveBeenCalledWith("assessment_1", {
      expected_mission_version: 7,
      approved_proposal_ids: ["proposal_1", "proposal_3"],
      reason: "Fix the defect",
    });
    expect(result.current.open).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith("Decided the proposals of Team workspaces.", {
      description: "2 fix nodes created, 1 proposal rejected. The proposer is Pending.",
    });
  });

  it("does nothing while no proposal is checked", async () => {
    const { result } = mount();

    act(() => result.current.request());
    await act(async () => result.current.confirm());

    expect(decideMock).not.toHaveBeenCalled();
    expect(result.current.open).toBe(true);
  });

  it("starts each request with no proposal checked and no reason", () => {
    const { result } = mount();

    act(() => result.current.request());
    act(() => result.current.toggle("proposal_1"));
    act(() => result.current.setReason("Old"));
    act(() => result.current.cancel());
    act(() => result.current.request());

    expect(result.current.checked).toEqual([]);
    expect(result.current.reason).toBe("");
  });

  it("drops a checked proposal that is no longer open", async () => {
    let proposals: readonly MissionProposal[] = PROPOSALS;
    const view = renderHook(() => useProposalDecision(PROPOSER, proposals, 7, vi.fn()));

    act(() => view.result.current.request());
    act(() => view.result.current.toggle("proposal_1"));
    proposals = [{ ...FIRST, approved_at: 1 }, SECOND, THIRD];
    view.rerender();

    expect(view.result.current.checked).toEqual([]);
    await act(async () => view.result.current.confirm());
    expect(decideMock).not.toHaveBeenCalled();

    act(() => view.result.current.toggle("proposal_2"));
    await act(async () => view.result.current.confirm());
    expect(decideMock).toHaveBeenCalledWith("assessment_1", {
      expected_mission_version: 7,
      approved_proposal_ids: ["proposal_2"],
    });
  });

  it("omits an empty reason", async () => {
    const { result } = mount();

    act(() => result.current.request());
    act(() => result.current.toggle("proposal_2"));
    await act(async () => result.current.confirm());

    expect(decideMock).toHaveBeenCalledWith("assessment_1", {
      expected_mission_version: 7,
      approved_proposal_ids: ["proposal_2"],
    });
  });

  it.each([
    [
      "mission.proposal.decided",
      "Another decision of this assessment came first. The view now shows it.",
    ],
    [
      "mission.proposal.assessment_mismatch",
      "A proposal no longer belongs to this assessment. The view now shows the current proposals.",
    ],
    ["mission.node.state_conflict", "The proposer is no longer Blocked"],
    ["mission.version.conflict", "The mission changed after this read."],
    [
      "mission.node.tags_unmatched",
      "Add a worker binding whose tags include every tag of this node, then try again.",
    ],
  ])("maps the conflict %s to a message and reloads", async (code, message) => {
    decideMock.mockRejectedValue(new ApiError("conflict", "Conflict.", 409, code));
    const { result, reload } = mount();

    act(() => result.current.request());
    act(() => result.current.toggle("proposal_1"));
    await act(async () => result.current.confirm());

    expect(result.current.error).toContain(message);
    expect(toast.error).toHaveBeenCalledWith("Deciding the proposals of Team workspaces failed.", {
      description: expect.stringContaining(message),
    });
    expect(result.current.open).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
