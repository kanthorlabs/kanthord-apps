import { render, screen, within } from "@testing-library/react";
import { useCallback } from "react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as missionApi from "@/api/resources/mission";
import type {
  MissionNodeRecord,
  MissionProposal,
  MissionProposalApproveResult,
  MissionRunnableNode,
} from "@/api/types";
import { buildGraph } from "@/lib/mission-graph";
import { useNodeProposals } from "../use-node-proposals";

vi.mock("@/api/resources/mission");
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import { ProposalSection } from "./proposal-section";

function runnable(
  id: string,
  kind: "initiative" | "objective",
  name: string,
  parentId: string | null,
  extra: Partial<MissionRunnableNode> = {},
): MissionRunnableNode {
  return {
    id,
    kind,
    filename: `${id}.md`,
    mission_id: "mission_1",
    parent_id: parentId,
    visible_revision: 1,
    content: { name, requirement: "r", criterion: "c", verifications: ["v"], bindings: [] },
    retired_at: null,
    pinned_by_attempts: [],
    state: "Completed",
    attempt: 1,
    priority: 0,
    depends_on: [],
    ...extra,
  };
}

const TEAM = runnable("node_team", "initiative", "Team workspaces", null, {
  state: "Blocked",
  attempt: 2,
});

const NODES: readonly MissionNodeRecord[] = [
  TEAM,
  runnable("node_invite", "objective", "Invite members", "node_team"),
  runnable("node_fix", "objective", "Fix the invite expiry", "node_team"),
];

const MODEL = buildGraph(NODES, []);

const OPEN: MissionProposal = {
  id: "proposal_open",
  node_id: "node_team",
  attempt: 2,
  assessment_id: "assessment_2",
  content: {
    objective_id: "node_invite",
    name: "Fix the invite link reuse",
    requirement: "An invite link works once.",
    criterion: "A second use of the link fails.",
    task: {
      name: "Mark the link used",
      requirement: "Store the use of the link.",
      criterion: "The store holds the use.",
      verifications: ["pnpm test invites"],
    },
  },
  objective_node_id: null,
  approved_at: null,
  created_at: 0,
};

const APPROVED: MissionProposal = {
  ...OPEN,
  id: "proposal_done",
  attempt: 1,
  content: { ...OPEN.content, name: "Fix the invite expiry" },
  objective_node_id: "node_fix",
  approved_at: 1,
};

function Harness({
  onChanged,
  onSelect,
}: {
  onChanged: () => void;
  onSelect: (nodeId: string) => void;
}) {
  const proposals = useNodeProposals(TEAM.id, true);
  const { reload } = proposals;
  const reloadAll = useCallback(() => {
    reload();
    onChanged();
  }, [reload, onChanged]);
  return (
    <ProposalSection
      model={MODEL}
      initiative={TEAM}
      proposals={proposals}
      missionVersion={9}
      onChanged={reloadAll}
      onSelect={onSelect}
    />
  );
}

function mount(onChanged = vi.fn(), onSelect = vi.fn()) {
  render(<Harness onChanged={onChanged} onSelect={onSelect} />);
  return { onChanged, onSelect };
}

function proposalItem(name: string): HTMLElement {
  const item = screen
    .getAllByRole("listitem")
    .find((candidate) => within(candidate).queryByText(name) !== null);
  if (item === undefined) throw new Error(`No proposal ${name}`);
  return item;
}

describe("ProposalSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(missionApi.listNodeProposals).mockResolvedValue([OPEN, APPROVED]);
    vi.mocked(missionApi.approveProposal).mockResolvedValue({} as MissionProposalApproveResult);
  });

  it("renders nothing for an initiative without proposals", async () => {
    vi.mocked(missionApi.listNodeProposals).mockResolvedValue([]);
    mount();

    await vi.waitFor(() => expect(missionApi.listNodeProposals).toHaveBeenCalledWith("node_team"));
    expect(screen.queryByRole("region", { name: "Fix proposals" })).toBeNull();
  });

  it("shows the target, the content and the task of a proposal", async () => {
    const { onSelect } = mount();

    await screen.findByRole("region", { name: "Fix proposals" });
    const item = proposalItem("Fix the invite link reuse");
    await userEvent.click(
      within(item).getByRole("button", {
        name: "Details of the proposal Fix the invite link reuse",
      }),
    );

    expect(within(item).getByText("proposed")).toBeTruthy();
    expect(within(item).getByText("An invite link works once.")).toBeTruthy();
    expect(within(item).getByText("A second use of the link fails.")).toBeTruthy();
    expect(within(item).getByText("Mark the link used")).toBeTruthy();
    expect(within(item).getByText("Store the use of the link.")).toBeTruthy();
    expect(within(item).getByText("The store holds the use.")).toBeTruthy();
    expect(within(item).getByText("pnpm test invites")).toBeTruthy();
    await userEvent.click(within(item).getByRole("button", { name: "Invite members" }));
    expect(onSelect).toHaveBeenCalledWith("node_invite");
  });

  it("shows an approved proposal with its objective and no approve", async () => {
    const { onSelect } = mount();

    await screen.findByRole("region", { name: "Fix proposals" });
    const item = proposalItem("Fix the invite expiry");
    await userEvent.click(
      within(item).getByRole("button", { name: "Details of the proposal Fix the invite expiry" }),
    );

    expect(within(item).getByText("approved")).toBeTruthy();
    expect(within(item).queryByRole("button", { name: "Approve proposal" })).toBeNull();
    const objective = within(item)
      .getAllByRole("button", { name: "Fix the invite expiry" })
      .at(-1) as HTMLElement;
    await userEvent.click(objective);
    expect(onSelect).toHaveBeenCalledWith("node_fix");
  });

  it("approves after the confirm with the mission version and refetches", async () => {
    const { onChanged } = mount();

    await screen.findByRole("region", { name: "Fix proposals" });
    const item = proposalItem("Fix the invite link reuse");
    await userEvent.click(
      within(item).getByRole("button", {
        name: "Details of the proposal Fix the invite link reuse",
      }),
    );
    await userEvent.click(within(item).getByRole("button", { name: "Approve proposal" }));
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.type(within(dialog).getByLabelText("Reason"), "The link must expire.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Approve proposal" }));

    expect(missionApi.approveProposal).toHaveBeenCalledWith("proposal_open", {
      expected_mission_version: 9,
      reason: "The link must expire.",
    });
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(missionApi.listNodeProposals).toHaveBeenCalledTimes(2);
  });

  it("shows the message of a version conflict and refetches", async () => {
    vi.mocked(missionApi.approveProposal).mockRejectedValue(
      new ApiError("conflict", "Version conflict.", 409, "mission.version.conflict"),
    );
    const { onChanged } = mount();

    await screen.findByRole("region", { name: "Fix proposals" });
    const item = proposalItem("Fix the invite link reuse");
    await userEvent.click(
      within(item).getByRole("button", {
        name: "Details of the proposal Fix the invite link reuse",
      }),
    );
    await userEvent.click(within(item).getByRole("button", { name: "Approve proposal" }));
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Approve proposal" }));

    expect(await within(dialog).findByRole("alert")).toHaveProperty(
      "textContent",
      "The mission changed after this read. The section now shows the current mission. Review the proposal and approve again.",
    );
    expect(onChanged).toHaveBeenCalledTimes(1);
  });
});
