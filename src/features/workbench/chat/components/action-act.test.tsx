import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import {
  checkNode,
  discardNode,
  listMissionNodes,
  listNodeExternalActions,
  listNodeProposals,
  overrideNode,
  pauseNode,
  readMission,
  readMissionNode,
} from "@/api/resources/mission";
import { listProjects, pauseProject, readProject, resumeProject } from "@/api/resources/projects";
import { listNodeExecutions } from "@/api/resources/scheduler";
import { reportWorkbenchAction } from "@/api/resources/workbench";
import type {
  MissionControlResult,
  MissionExternalAction,
  MissionNodeRecord,
  NodeState,
  Project,
  WorkbenchActionOffer,
} from "@/api/types";
import type { ActionCardItem } from "@/lib/workbench-chat";
import { ActionCardEntry } from "./action-card-entry";

vi.mock("@/api/resources/mission");
vi.mock("@/api/resources/projects");
vi.mock("@/api/resources/scheduler");
vi.mock("@/api/resources/workbench");
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

const SESSION_ID = "workbench_session_1";

function node(state: NodeState, attempt = 3): MissionNodeRecord {
  return {
    id: "node_42",
    intent: "implement",
    tags: [],
    tasks: [],
    filename: "audit.md",
    mission_id: "mission_1",
    visible_revision: 2,
    content: {
      name: "Audit log",
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
    state,
    attempt,
    priority: 0,
    depends_on: [],
  };
}

function project(pausedAt: number | null): Project {
  return {
    id: "prj-1",
    name: "atlas",
    binding_set_version: 1,
    created_at: 1,
    paused_at: pausedAt,
    workspace_directory: "/state/prj-1",
  };
}

function unresolved(): MissionExternalAction {
  return {
    node_id: "node_42",
    attempt: 3,
    action: {
      key: "repo.pull_request",
      binding_id: "binding_1",
      action: "pull_request",
      expected_end_state: "pull_request_merged",
      follows: null,
      configuration: { base_branch: "main", landing: "human" },
    },
    requested: true,
    request_evidence_id: "evidence_1",
    resolution: "unresolved",
  };
}

function card(
  operationId: string,
  targetId: string,
  seen: WorkbenchActionOffer["seen"],
): ActionCardItem {
  return {
    kind: "action-card",
    id: "e1",
    offer: {
      kind: "action_offer",
      tool_call_id: "call_1",
      operation_id: operationId,
      target_id: targetId,
      seen,
    },
    results: [],
    state: "live",
  };
}

function nodeCard(operationId: string, state: NodeState = "Executing") {
  return card(operationId, "node_42", { name: "Add retry to payment client", state, attempt: 3 });
}

function mount(item: ActionCardItem) {
  render(<ActionCardEntry item={item} sessionId={SESSION_ID} canRun />);
  return userEvent.setup();
}

function serve(read: MissionNodeRecord, actions: readonly MissionExternalAction[] = []) {
  vi.mocked(readMissionNode).mockResolvedValue(read);
  vi.mocked(listProjects).mockResolvedValue([project(null)]);
  vi.mocked(readMission).mockResolvedValue({ id: "mission_1", project_id: "prj-1", version: 7 });
  vi.mocked(listMissionNodes).mockResolvedValue([read]);
  vi.mocked(listNodeProposals).mockResolvedValue([]);
  vi.mocked(listNodeExternalActions).mockResolvedValue(actions);
  vi.mocked(listNodeExecutions).mockResolvedValue([]);
}

async function fillReason(user: ReturnType<typeof userEvent.setup>, reason: string) {
  await user.type(await screen.findByRole("textbox", { name: "Reason" }), reason);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(reportWorkbenchAction).mockResolvedValue({
    session_id: SESSION_ID,
    tool_call_id: "call_1",
    outcome: "done",
  });
  vi.mocked(discardNode).mockResolvedValue({} as MissionControlResult);
  vi.mocked(pauseNode).mockResolvedValue({} as MissionControlResult);
  vi.mocked(overrideNode).mockResolvedValue({} as MissionControlResult);
});

describe("ActionAct on a node", () => {
  it("shows the change line and calls no route when the state differs from seen", async () => {
    serve(node("Blocked"));
    const user = mount(nodeCard("mission.node.discard"));

    await user.click(screen.getByRole("button", { name: "Discard node_42" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /^node_42 changed since the card: it is now Blocked \(attempt 3\)\. Nothing ran\.$/,
    );
    expect(screen.getByRole("group", { name: "Action" })).toHaveAccessibleDescription(
      "node_42 changed since the card: it is now Blocked (attempt 3). Nothing ran.",
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(discardNode).not.toHaveBeenCalled();
    expect(reportWorkbenchAction).not.toHaveBeenCalled();
  });

  it("shows the change line when only the attempt differs", async () => {
    serve(node("Executing", 4));
    const user = mount(nodeCard("mission.node.discard"));

    await user.click(screen.getByRole("button", { name: "Discard node_42" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "it is now Executing (attempt 4). Nothing ran.",
    );
    expect(discardNode).not.toHaveBeenCalled();
  });

  it("opens the discard dialog, then discards with the click-time fields and reports done", async () => {
    serve(node("Executing"));
    const user = mount(nodeCard("mission.node.discard"));

    await user.click(screen.getByRole("button", { name: "Discard node_42" }));

    expect(await screen.findByRole("alertdialog", { name: "Discard Audit log?" })).toBeVisible();
    expect(screen.getByText(/A discard cannot be undone\./)).toBeVisible();
    expect(discardNode).not.toHaveBeenCalled();
    await fillReason(user, "Out of scope");
    await user.click(screen.getByRole("button", { name: "Discard node" }));

    await waitFor(() =>
      expect(reportWorkbenchAction).toHaveBeenCalledWith(SESSION_ID, "call_1", {
        outcome: "done",
        error_code: null,
      }),
    );
    expect(discardNode).toHaveBeenCalledWith("node_42", {
      reason: "Out of scope",
      expected_mission_version: 7,
      expected_state: "Executing",
      expected_attempt: 3,
    });
    await waitFor(() => expect(screen.getByRole("group", { name: "Action" })).toHaveFocus());
  });

  it("opens the discard dialog when the mission read of an unrelated project fails", async () => {
    serve(node("Executing"));
    vi.mocked(listProjects).mockResolvedValue([{ ...project(null), id: "prj-2" }, project(null)]);
    vi.mocked(readMission).mockImplementation(async (projectId) => {
      if (projectId === "prj-2") throw new ApiError("unavailable", "down", 503);
      return { id: "mission_1", project_id: "prj-1", version: 7 };
    });
    const user = mount(nodeCard("mission.node.discard"));

    await user.click(screen.getByRole("button", { name: "Discard node_42" }));

    expect(await screen.findByRole("alertdialog", { name: "Discard Audit log?" })).toBeVisible();
  });

  it("shows the error and reports failed with the owning code of a 409", async () => {
    serve(node("Executing"));
    vi.mocked(discardNode).mockRejectedValue(
      new ApiError("conflict", "Conflict.", 409, "mission.node.state_conflict"),
    );
    const user = mount(nodeCard("mission.node.discard"));

    await user.click(screen.getByRole("button", { name: "Discard node_42" }));
    await fillReason(user, "Out of scope");
    await user.click(screen.getByRole("button", { name: "Discard node" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The state or the attempt of the node changed after this read.",
    );
    expect(reportWorkbenchAction).toHaveBeenCalledTimes(1);
    expect(reportWorkbenchAction).toHaveBeenCalledWith(SESSION_ID, "call_1", {
      outcome: "failed",
      error_code: "mission.node.state_conflict",
    });
  });

  it("reports nothing when the dialog is cancelled", async () => {
    serve(node("Executing"));
    const user = mount(nodeCard("mission.node.discard"));

    await user.click(screen.getByRole("button", { name: "Discard node_42" }));
    await user.click(await screen.findByRole("button", { name: "Keep the node" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await waitFor(() => expect(screen.getByRole("group", { name: "Action" })).toHaveFocus());
    expect(discardNode).not.toHaveBeenCalled();
    expect(reportWorkbenchAction).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Discard node_42" })).toBeEnabled();
  });

  it("opens the override dialog before any route call", async () => {
    serve(node("Executing"));
    const user = mount(nodeCard("mission.node.override"));

    await user.click(screen.getByRole("button", { name: "Override node_42" }));

    expect(await screen.findByRole("alertdialog", { name: "Override Audit log?" })).toBeVisible();
    expect(overrideNode).not.toHaveBeenCalled();
    expect(reportWorkbenchAction).not.toHaveBeenCalled();
  });

  it("opens the node pause dialog, then pauses with the reason and reports done", async () => {
    serve(node("Executing"));
    const user = mount(nodeCard("mission.node.pause"));

    await user.click(screen.getByRole("button", { name: "Pause node_42" }));

    expect(await screen.findByRole("alertdialog", { name: "Pause Audit log?" })).toBeVisible();
    expect(pauseNode).not.toHaveBeenCalled();
    await fillReason(user, "Hold for review");
    await user.click(screen.getByRole("button", { name: "Pause node" }));

    await waitFor(() =>
      expect(reportWorkbenchAction).toHaveBeenCalledWith(SESSION_ID, "call_1", {
        outcome: "done",
        error_code: null,
      }),
    );
    expect(pauseNode).toHaveBeenCalledWith("node_42", {
      reason: "Hold for review",
      expected_mission_version: 7,
      expected_state: "Executing",
      expected_attempt: 3,
    });
  });

  it("runs the check at once and reports its outcome", async () => {
    serve(node("External.Requested"), [unresolved()]);
    vi.mocked(checkNode).mockResolvedValue({
      results: [
        {
          evidence_id: "evidence_1",
          requirement_key: "repo.pull_request",
          resolution: "expected-end",
        },
      ],
      failures: [],
      link_updates: [],
    });
    const user = mount(nodeCard("mission.node.check", "External.Requested"));

    await user.click(screen.getByRole("button", { name: "Check node_42" }));

    await waitFor(() =>
      expect(reportWorkbenchAction).toHaveBeenCalledWith(SESSION_ID, "call_1", {
        outcome: "done",
        error_code: null,
      }),
    );
    expect(checkNode).toHaveBeenCalledWith("node_42", { expected_mission_version: 7 });
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("shows Not available and runs nothing for a node that admits no act", async () => {
    serve(node("Completed"));
    const user = mount(nodeCard("mission.node.pause", "Completed"));

    await user.click(screen.getByRole("button", { name: "Pause node_42" }));

    expect(await screen.findByText("Not available: node_42 is Completed.")).toBeVisible();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(pauseNode).not.toHaveBeenCalled();
    expect(reportWorkbenchAction).not.toHaveBeenCalled();
  });
});

describe("ActionAct on a project", () => {
  it("resumes a paused project at once and reports done", async () => {
    vi.mocked(readProject).mockResolvedValue(project(5));
    vi.mocked(resumeProject).mockResolvedValue(project(null));
    const user = mount(card("project.resume", "prj-1", { name: "Billing", paused: true }));

    await user.click(screen.getByRole("button", { name: "Resume prj-1" }));

    await waitFor(() =>
      expect(reportWorkbenchAction).toHaveBeenCalledWith(SESSION_ID, "call_1", {
        outcome: "done",
        error_code: null,
      }),
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(resumeProject).toHaveBeenCalledWith("prj-1");
  });

  it("shows Not available for a resume of an active project and calls no route", async () => {
    vi.mocked(readProject).mockResolvedValue(project(null));
    const user = mount(card("project.resume", "prj-1", { name: "Billing", paused: false }));

    await user.click(screen.getByRole("button", { name: "Resume prj-1" }));

    expect(await screen.findByText("Not available: prj-1 is active.")).toBeVisible();
    expect(resumeProject).not.toHaveBeenCalled();
    expect(reportWorkbenchAction).not.toHaveBeenCalled();
  });

  it("shows the change line when the pause state differs from seen", async () => {
    vi.mocked(readProject).mockResolvedValue(project(5));
    const user = mount(card("project.pause", "prj-1", { name: "Billing", paused: false }));

    await user.click(screen.getByRole("button", { name: "Pause prj-1" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /^prj-1 changed since the card: it is now paused\. Nothing ran\.$/,
    );
    expect(pauseProject).not.toHaveBeenCalled();
  });

  it("opens the pause dialog, then pauses on Confirm and reports done", async () => {
    vi.mocked(readProject).mockResolvedValue(project(null));
    vi.mocked(pauseProject).mockResolvedValue(project(5));
    const user = mount(card("project.pause", "prj-1", { name: "Billing", paused: false }));

    await user.click(screen.getByRole("button", { name: "Pause prj-1" }));

    expect(await screen.findByRole("alertdialog", { name: "Pause atlas?" })).toBeVisible();
    expect(pauseProject).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Pause project" }));

    await waitFor(() =>
      expect(reportWorkbenchAction).toHaveBeenCalledWith(SESSION_ID, "call_1", {
        outcome: "done",
        error_code: null,
      }),
    );
    expect(pauseProject).toHaveBeenCalledWith("prj-1");
  });

  it("calls no route and reports nothing when the pause dialog is cancelled", async () => {
    vi.mocked(readProject).mockResolvedValue(project(null));
    const user = mount(card("project.pause", "prj-1", { name: "Billing", paused: false }));

    await user.click(screen.getByRole("button", { name: "Pause prj-1" }));
    await user.click(await screen.findByRole("button", { name: "Keep the project active" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await waitFor(() => expect(screen.getByRole("group", { name: "Action" })).toHaveFocus());
    expect(pauseProject).not.toHaveBeenCalled();
    expect(reportWorkbenchAction).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Pause prj-1" })).toBeEnabled();
  });
});

describe("ActionCardEntry report", () => {
  async function resumeWith(reportFailure: ApiError | null) {
    vi.mocked(readProject).mockResolvedValue(project(5));
    vi.mocked(resumeProject).mockResolvedValue(project(null));
    if (reportFailure !== null) vi.mocked(reportWorkbenchAction).mockRejectedValue(reportFailure);
    const user = mount(card("project.resume", "prj-1", { name: "Billing", paused: true }));
    await user.click(screen.getByRole("button", { name: "Resume prj-1" }));
  }

  it("shows the owning code and the unrecorded line when the report fails", async () => {
    await resumeWith(new ApiError("not_found", "Gone.", 404, "workbench.session.action_not_found"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "workbench.session.action_not_found The result was not recorded.",
    );
    expect(screen.getByRole("button", { name: "Resume prj-1" })).toBeEnabled();
  });

  it("counts an action_settled answer to a done report as done", async () => {
    await resumeWith(new ApiError("conflict", "Settled.", 409, "workbench.session.action_settled"));

    await waitFor(() => expect(reportWorkbenchAction).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("sends a null code for a code that fails the code pattern", async () => {
    vi.mocked(readProject).mockResolvedValue(project(5));
    vi.mocked(resumeProject).mockRejectedValue(
      new ApiError("refused", "Refused.", 422, "Not A Code"),
    );
    const user = mount(card("project.resume", "prj-1", { name: "Billing", paused: true }));

    await user.click(screen.getByRole("button", { name: "Resume prj-1" }));

    await waitFor(() =>
      expect(reportWorkbenchAction).toHaveBeenCalledWith(SESSION_ID, "call_1", {
        outcome: "failed",
        error_code: null,
      }),
    );
  });
});
