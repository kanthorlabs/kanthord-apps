import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as missionApi from "@/api/resources/mission";
import type { MissionFollowupProposal, MissionLinkUpdate, MissionNodeRecord } from "@/api/types";
import { useFollowupDecision } from "@/hooks/use-followup-decision";

vi.mock("@/api/resources/mission");
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import { FollowupDecisionDialog } from "./followup-decision-dialog";

const NODE: MissionNodeRecord = {
  id: "node_signup",
  intent: "implement",
  tags: [],
  tasks: [],
  filename: "signup.md",
  mission_id: "mission_1",
  visible_revision: 1,
  content: {
    name: "Sign-up form",
    requirement: "r",
    criterion: "c",
    verifications: [],
    bindings: [],
    intent: "implement",
    tags: [],
  },
  retired_at: null,
  pinned_by_attempts: [],
  pinned_revision: null,
  state: "Completed",
  attempt: 1,
  priority: 0,
  depends_on: [],
};

const PROPOSAL: MissionFollowupProposal = {
  id: "followup_1",
  node_id: "node_signup",
  attempt: 1,
  assessment_id: null,
  content: {
    name: "Reply on the issue",
    requirement: "Tell the reporter that the form is fixed.",
    criterion: "The issue holds the reply.",
  },
  created_node_id: null,
  approved_at: null,
  rejected_at: null,
  created_at: 1,
};

const UPDATE: MissionLinkUpdate = {
  id: "link_update_1",
  external_link: {
    kind: "github_issue",
    resource_identity: "conversation:github:kanthorlabs/kanthord",
    number: 42,
  },
  update_key: "comment:1",
  inbound_event_id: "inbound_event_1",
  actor_id: "octocat",
  occurred_at: Date.UTC(2025, 0, 1, 9, 0),
  new: true,
};

const reload = vi.fn();

function Harness() {
  const decision = useFollowupDecision(NODE, [PROPOSAL], 7, reload);
  return (
    <>
      <button type="button" onClick={decision.request}>
        Open
      </button>
      <FollowupDecisionDialog name={NODE.content.name} decision={decision} />
    </>
  );
}

async function openDialog() {
  render(<Harness />);
  await userEvent.click(screen.getByRole("button", { name: "Open" }));
  return screen.findByRole("alertdialog");
}

describe("FollowupDecisionDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(missionApi.listNodeLinkUpdates).mockResolvedValue([UPDATE]);
    vi.mocked(missionApi.decideFollowup).mockResolvedValue({});
  });

  it("shows the proposal, the newest link updates and the warning", async () => {
    const dialog = await openDialog();

    expect(dialog).toHaveTextContent("A decision cannot be undone.");
    expect(dialog).toHaveTextContent("Reply on the issue");
    expect(dialog).toHaveTextContent("The issue holds the reply.");
    expect(await screen.findByText("kanthorlabs/kanthord#42")).toBeTruthy();
    expect(screen.getByText("New")).toBeTruthy();
    expect(missionApi.listNodeLinkUpdates).toHaveBeenCalledWith("node_signup");
  });

  it("creates the follow-up node with the filled fields", async () => {
    await openDialog();

    await userEvent.type(screen.getByLabelText("Requirement"), "Reply with the fix");
    await userEvent.type(screen.getByLabelText("Criterion"), "The reply links the fix");
    await userEvent.click(screen.getByRole("button", { name: "Create follow-up node" }));

    expect(missionApi.decideFollowup).toHaveBeenCalledWith("node_signup", {
      expected_mission_version: 7,
      approve: true,
      requirement: "Reply with the fix",
      criterion: "The reply links the fix",
    });
    expect(reload).toHaveBeenCalledOnce();
    expect(missionApi.decideProposals).not.toHaveBeenCalled();
  });

  it("creates the follow-up node with no optional field when none is filled", async () => {
    await openDialog();

    await userEvent.click(screen.getByRole("button", { name: "Create follow-up node" }));

    expect(missionApi.decideFollowup).toHaveBeenCalledWith("node_signup", {
      expected_mission_version: 7,
      approve: true,
    });
  });

  it("rejects with approve false and no requirement or criterion", async () => {
    await openDialog();

    await userEvent.type(screen.getByLabelText("Requirement"), "Ignored");
    await userEvent.type(screen.getByLabelText("Criterion"), "Ignored");
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));

    expect(missionApi.decideFollowup).toHaveBeenCalledWith("node_signup", {
      expected_mission_version: 7,
      approve: false,
    });
    expect(reload).toHaveBeenCalledOnce();
  });

  it("keeps the dialog open and shows the refusal of the daemon", async () => {
    vi.mocked(missionApi.decideFollowup).mockRejectedValue(
      new ApiError("conflict", "The proposal was decided.", 409),
    );
    await openDialog();

    await userEvent.click(screen.getByRole("button", { name: "Reject" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The proposal was decided.");
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(toast.error).toHaveBeenCalledOnce();
  });
});
