import { render, screen, within } from "@testing-library/react";
import { useCallback } from "react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as missionApi from "@/api/resources/mission";
import type {
  Intent,
  MissionNodeRecord,
  MissionProposal,
  MissionProposalDecideResult,
} from "@/api/types";
import { buildGraph } from "@/lib/mission-graph";
import { useNodeProposals } from "../use-node-proposals";

vi.mock("@/api/resources/mission");
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import { ProposalSection } from "./proposal-section";

function node(
  id: string,
  intent: Intent,
  name: string,
  extra: Partial<MissionNodeRecord> = {},
): MissionNodeRecord {
  return {
    id,
    intent,
    tags: [],
    tasks: [],
    filename: `${id}.md`,
    mission_id: "mission_1",
    visible_revision: 1,
    content: {
      name,
      requirement: "r",
      criterion: "c",
      verifications: ["v"],
      bindings: [],
      intent,
      tags: [],
    },
    retired_at: null,
    pinned_by_attempts: [],
    pinned_revision: null,
    state: "Completed",
    attempt: 1,
    priority: 0,
    depends_on: [],
    ...extra,
  };
}

const TEAM = node("node_team", "examine", "Team workspaces", {
  state: "Blocked",
  attempt: 2,
});

const NODES: readonly MissionNodeRecord[] = [
  TEAM,
  node("node_invite", "implement", "Invite members"),
  node("node_fix", "implement", "Fix the invite expiry"),
];

const MODEL = buildGraph(NODES, []);

const OPEN: MissionProposal = {
  id: "proposal_open",
  node_id: "node_team",
  attempt: 2,
  assessment_id: "assessment_2",
  content: {
    dependency_id: "node_invite",
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
  created_node_id: null,
  approved_at: null,
  rejected_at: null,
  created_at: 0,
};

const OPEN_RESEND: MissionProposal = {
  ...OPEN,
  id: "proposal_resend",
  content: { ...OPEN.content, name: "Fix the invite resend" },
};

const OPEN_DOMAIN: MissionProposal = {
  ...OPEN,
  id: "proposal_domain",
  content: { ...OPEN.content, name: "Fix the invite domain" },
};

const REJECTED: MissionProposal = {
  ...OPEN,
  id: "proposal_rejected",
  attempt: 1,
  content: { ...OPEN.content, name: "Fix the invite banner" },
  rejected_at: 1,
};

const APPROVED: MissionProposal = {
  ...OPEN,
  id: "proposal_done",
  attempt: 1,
  content: { ...OPEN.content, name: "Fix the invite expiry" },
  created_node_id: "node_fix",
  approved_at: 1,
};

const CHANGE = {
  revisions: [],
  retired_node_ids: [],
  added_edges: [],
  removed_edges: [],
  open_attempts_unchanged: [],
};

const DECIDE_ANSWER: MissionProposalDecideResult = {
  created: [
    { ...CHANGE, mission_version: 10 },
    { ...CHANGE, mission_version: 11 },
  ],
  rejected_proposal_ids: ["proposal_resend"],
  proposer: {
    node: { ...TEAM, state: "Pending", attempt: 3 },
    attempt: null,
    outcome: null,
    actor: { kind: "human", account: "ulrich", name: "Ulrich" },
    accepted_at: 1,
  },
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
      proposer={TEAM}
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
    vi.mocked(missionApi.decideProposals).mockResolvedValue(DECIDE_ANSWER);
  });

  it("renders nothing for an examine node without proposals", async () => {
    vi.mocked(missionApi.listNodeProposals).mockResolvedValue([]);
    mount();

    await vi.waitFor(() => expect(missionApi.listNodeProposals).toHaveBeenCalledWith("node_team"));
    expect(screen.queryByRole("region", { name: "Fix proposals" })).toBeNull();
  });

  it("shows the dependency, the content and the task of a proposal", async () => {
    const { onSelect } = mount();

    await screen.findByRole("region", { name: "Fix proposals" });
    const item = proposalItem("Fix the invite link reuse");
    await userEvent.click(
      within(item).getByRole("button", {
        name: "Details of the proposal Fix the invite link reuse",
      }),
    );

    expect(within(item).getByText("open")).toBeTruthy();
    expect(within(item).getByText("An invite link works once.")).toBeTruthy();
    expect(within(item).getByText("A second use of the link fails.")).toBeTruthy();
    expect(within(item).getByText("Mark the link used")).toBeTruthy();
    expect(within(item).getByText("Store the use of the link.")).toBeTruthy();
    expect(within(item).getByText("The store holds the use.")).toBeTruthy();
    expect(within(item).getByText("pnpm test invites")).toBeTruthy();
    expect(within(item).getByText("Dependency")).toBeTruthy();
    await userEvent.click(within(item).getByRole("button", { name: "Invite members" }));
    expect(onSelect).toHaveBeenCalledWith("node_invite");
  });

  it("shows an approved proposal with its created node", async () => {
    const { onSelect } = mount();

    await screen.findByRole("region", { name: "Fix proposals" });
    const item = proposalItem("Fix the invite expiry");
    await userEvent.click(
      within(item).getByRole("button", { name: "Details of the proposal Fix the invite expiry" }),
    );

    expect(within(item).getByText("approved")).toBeTruthy();
    expect(within(item).getByText("Created node")).toBeTruthy();
    const created = within(item)
      .getAllByRole("button", { name: "Fix the invite expiry" })
      .at(-1) as HTMLElement;
    await userEvent.click(created);
    expect(onSelect).toHaveBeenCalledWith("node_fix");
  });

  it("decides two of three open proposals in one dialog", async () => {
    vi.mocked(missionApi.listNodeProposals).mockResolvedValue([OPEN, OPEN_RESEND, OPEN_DOMAIN]);
    const { onChanged } = mount();

    const region = await screen.findByRole("region", { name: "Fix proposals" });
    await userEvent.click(
      within(proposalItem("Fix the invite link reuse")).getByRole("button", {
        name: "Details of the proposal Fix the invite link reuse",
      }),
    );
    expect(screen.queryByRole("button", { name: "Approve proposal" })).toBeNull();
    await userEvent.click(within(region).getByRole("button", { name: "Decide" }));
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(
      within(dialog).getByRole("checkbox", { name: "Fix the invite link reuse" }),
    );
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Fix the invite domain" }));
    await userEvent.type(within(dialog).getByLabelText("Reason"), "The link must expire.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Decide" }));

    expect(missionApi.decideProposals).toHaveBeenCalledTimes(1);
    expect(missionApi.decideProposals).toHaveBeenCalledWith("assessment_2", {
      expected_mission_version: 9,
      approved_proposal_ids: ["proposal_open", "proposal_domain"],
      reason: "The link must expire.",
    });
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(missionApi.listNodeProposals).toHaveBeenCalledTimes(2);
  });

  it("keeps the confirm disabled until one proposal is checked", async () => {
    vi.mocked(missionApi.listNodeProposals).mockResolvedValue([OPEN, OPEN_RESEND, OPEN_DOMAIN]);
    mount();

    const region = await screen.findByRole("region", { name: "Fix proposals" });
    await userEvent.click(within(region).getByRole("button", { name: "Decide" }));
    const dialog = await screen.findByRole("alertdialog");

    expect(
      within(dialog).getByText(
        "Check one proposal or more. To reject every proposal, use Unblock or Discard.",
      ),
    ).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Decide" })).toHaveProperty("disabled", true);
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Fix the invite resend" }));
    expect(within(dialog).getByRole("button", { name: "Decide" })).toHaveProperty(
      "disabled",
      false,
    );
  });

  it("shows a rejected proposal with its time and no decide", async () => {
    vi.mocked(missionApi.listNodeProposals).mockResolvedValue([REJECTED]);
    mount();

    const region = await screen.findByRole("region", { name: "Fix proposals" });
    const item = proposalItem("Fix the invite banner");
    await userEvent.click(
      within(item).getByRole("button", { name: "Details of the proposal Fix the invite banner" }),
    );

    expect(within(item).getByText("rejected")).toBeTruthy();
    expect(within(item).getByText("Rejected")).toBeTruthy();
    expect(within(region).queryByRole("button", { name: "Decide" })).toBeNull();
  });

  it("shows the message of a version conflict and refetches", async () => {
    vi.mocked(missionApi.decideProposals).mockRejectedValue(
      new ApiError("conflict", "Version conflict.", 409, "mission.version.conflict"),
    );
    const { onChanged } = mount();

    const region = await screen.findByRole("region", { name: "Fix proposals" });
    await userEvent.click(within(region).getByRole("button", { name: "Decide" }));
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(
      within(dialog).getByRole("checkbox", { name: "Fix the invite link reuse" }),
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Decide" }));

    expect(await within(dialog).findByRole("alert")).toHaveProperty(
      "textContent",
      "The mission changed after this read. The view now shows the current mission. Review the proposals and decide again.",
    );
    expect(onChanged).toHaveBeenCalledTimes(1);
  });
});
