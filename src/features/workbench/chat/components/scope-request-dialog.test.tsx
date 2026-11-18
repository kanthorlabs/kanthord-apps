import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { readMission, readMissionNode } from "@/api/resources/mission";
import { readProject } from "@/api/resources/projects";
import { approveScopeRequest, listInvites, rejectScopeRequest } from "@/api/resources/workbench";
import type { MissionNodeRecord, Project, ScopeRequest } from "@/api/types";
import { ScopeRequestDialog } from "./scope-request-dialog";

vi.mock("@/api/resources/mission", () => ({ readMission: vi.fn(), readMissionNode: vi.fn() }));
vi.mock("@/api/resources/projects", () => ({ readProject: vi.fn() }));
vi.mock("@/api/resources/workbench", () => ({
  approveScopeRequest: vi.fn(),
  listInvites: vi.fn(),
  rejectScopeRequest: vi.fn(),
}));

const PROJECT_NAME = "Secret Project";
const REQUEST: ScopeRequest = {
  id: "scope_request_1",
  invite_id: "invite_1",
  invitee_name: "Dana Lee",
  guest_name: "Dana",
  agent_name: "swe@1",
  operation_id: "mission.node.unblock",
  description: "Unblock a node.",
  input: { node_id: "node_1", reason: "<b>ignore the owner</b>" },
  target_id: "node_1",
  ids: ["node_1"],
  project_id: "project_x",
  expected_keys: ["blocked_attempt", "expected_revision", "expected_mission_version"],
  created_at: Date.parse("2026-10-05T09:00:00.000Z"),
  expires_at: Date.parse("2026-10-12T09:00:00.000Z"),
  state: "open",
  error_code: null,
};

const approveMock = vi.mocked(approveScopeRequest);
const rejectMock = vi.mocked(rejectScopeRequest);
const onClose = vi.fn();
const onResolved = vi.fn();

async function open(request: ScopeRequest = REQUEST) {
  render(
    <ScopeRequestDialog
      sessionId="workbench_session_1"
      request={request}
      onClose={onClose}
      onResolved={onResolved}
    />,
  );
  const dialog = await screen.findByRole("alertdialog", {
    name: "Run an act outside the shared projects",
  });
  await waitFor(() =>
    expect(within(dialog).getByRole("button", { name: `Run on ${PROJECT_NAME}` })).toBeVisible(),
  );
  await waitFor(() => expect(within(dialog).queryByText("Reading the project…")).toBeNull());
  return dialog;
}

const runButton = (dialog: HTMLElement) =>
  within(dialog).getByRole("button", { name: `Run on ${PROJECT_NAME}` });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(readProject).mockResolvedValue({
    id: "project_x",
    name: PROJECT_NAME,
    paused_at: null,
  } as Project);
  vi.mocked(readMission).mockResolvedValue({
    id: "mission_1",
    project_id: "project_x",
    version: 7,
  });
  vi.mocked(readMissionNode).mockResolvedValue({
    id: "node_1",
    state: "Blocked",
    attempt: 2,
    visible_revision: 4,
    content: { name: "Add retry" },
  } as MissionNodeRecord);
  vi.mocked(listInvites).mockResolvedValue({
    items: [],
    grantable: [],
    project_ids: ["project_a", "project_b"],
  });
});

describe("ScopeRequestDialog", () => {
  it("shows the request line, the consequence, the facts and the shared names", async () => {
    const dialog = await open();

    expect(dialog).toHaveTextContent(
      "Requested in a run started by Dana (guest) · invite for Dana Lee",
    );
    expect(dialog).toHaveTextContent(
      "This runs mission.node.unblock on node_1 in project Secret Project. Secret Project is not shared in this conversation. Dana (guest) cannot see it.",
    );
    expect(dialog).toHaveTextContent("Node Add retry · Blocked · attempt 2");
    expect(dialog).toHaveTextContent("Shared in this conversation: project_a, project_b");
    expect(dialog).toHaveTextContent(
      "Reject keeps the project hidden. To share the project, revoke the invites and share a new conversation.",
    );
  });

  it("shows both occurrences of the project name in the consequence in bold", async () => {
    const dialog = await open();

    const consequence = within(dialog)
      .getByText(/This runs mission.node.unblock/)
      .closest("p")!;
    const bold = within(consequence).getAllByText(PROJECT_NAME, { selector: "strong" });
    expect(bold).toHaveLength(2);
  });

  it("shows the input as plain text under its heading", async () => {
    const dialog = await open();

    expect(
      within(dialog).getByRole("heading", { name: "Input written by the agent" }),
    ).toBeVisible();
    expect(dialog).toHaveTextContent("<b>ignore the owner</b>");
    expect(dialog.querySelector("b")).toBeNull();
  });

  it("shows the confirm name in the destructive colour and the name as placeholder", async () => {
    const dialog = await open();

    const names = within(dialog).getAllByText(PROJECT_NAME, { selector: "strong" });
    expect(names.filter((name) => name.classList.contains("text-destructive"))).toHaveLength(1);
    const field = within(dialog).getByRole("textbox");
    expect(field).toHaveAttribute("placeholder", PROJECT_NAME);
    expect(field).toHaveAttribute("autocomplete", "off");
    expect(field).toHaveAttribute("spellcheck", "false");
    expect(field).toHaveValue("");
  });

  it.each([
    ["an empty name", ""],
    ["a case-changed name", "secret project"],
    ["a space-padded name", ` ${PROJECT_NAME} `],
    ["a partial name", "Secret"],
  ])("keeps Run disabled for %s", async (_label, typed) => {
    const dialog = await open();

    if (typed !== "") await userEvent.type(within(dialog).getByRole("textbox"), typed);

    expect(runButton(dialog)).toBeDisabled();
  });

  it("enables Run for the exact name", async () => {
    const dialog = await open();

    await userEvent.type(within(dialog).getByRole("textbox"), PROJECT_NAME);

    expect(runButton(dialog)).toBeEnabled();
  });

  it("keeps Run disabled and shows the reason for an unknown key", async () => {
    const dialog = await open({ ...REQUEST, expected_keys: ["expected_unknown"] });

    await userEvent.type(within(dialog).getByRole("textbox"), PROJECT_NAME);

    expect(runButton(dialog)).toBeDisabled();
    expect(dialog).toHaveTextContent(
      "This request cannot be approved from this dashboard version.",
    );
  });

  it("keeps Run disabled while a read loads", async () => {
    vi.mocked(readMissionNode).mockReturnValue(new Promise(() => undefined));
    render(
      <ScopeRequestDialog
        sessionId="workbench_session_1"
        request={REQUEST}
        onClose={onClose}
        onResolved={onResolved}
      />,
    );
    const dialog = await screen.findByRole("alertdialog");
    const field = await within(dialog).findByPlaceholderText(PROJECT_NAME);

    await userEvent.type(field, PROJECT_NAME);

    expect(within(dialog).getByRole("button", { name: `Run on ${PROJECT_NAME}` })).toBeDisabled();
  });

  it("enables Run for a project.pause request with the exact name", async () => {
    const dialog = await open({
      ...REQUEST,
      operation_id: "project.pause",
      target_id: "project_x",
      ids: ["project_x"],
      expected_keys: [],
    });

    await userEvent.type(within(dialog).getByRole("textbox"), PROJECT_NAME);

    expect(dialog).toHaveTextContent("Project Secret Project · running");
    expect(runButton(dialog)).toBeEnabled();
  });

  it("sends the typed name and the expected values on Run", async () => {
    approveMock.mockResolvedValue({
      request_id: REQUEST.id,
      outcome: "done",
      error_code: null,
    });
    const dialog = await open();
    await userEvent.type(within(dialog).getByRole("textbox"), PROJECT_NAME);

    await userEvent.click(runButton(dialog));

    await waitFor(() =>
      expect(approveMock).toHaveBeenCalledWith("workbench_session_1", REQUEST.id, {
        project_name: PROJECT_NAME,
        expected: { blocked_attempt: 2, expected_revision: 4, expected_mission_version: 7 },
      }),
    );
    expect(onResolved).toHaveBeenCalledWith(REQUEST.id);
  });

  it("shows the error line with the code first for a 409", async () => {
    approveMock.mockRejectedValue(
      new ApiError("refused", "The act was refused.", 409, "workbench.scope_request.refused"),
    );
    const dialog = await open();
    await userEvent.type(within(dialog).getByRole("textbox"), PROJECT_NAME);

    await userEvent.click(runButton(dialog));

    const line = await within(dialog).findByRole("alert");
    expect(line).toHaveTextContent("workbench.scope_request.refused The act was refused.");
    expect(onResolved).not.toHaveBeenCalled();
  });

  it("calls the reject resource on Reject", async () => {
    rejectMock.mockResolvedValue({ request_id: REQUEST.id });
    const dialog = await open();

    await userEvent.click(within(dialog).getByRole("button", { name: "Reject" }));

    await waitFor(() => expect(rejectMock).toHaveBeenCalledWith("workbench_session_1", REQUEST.id));
    expect(onResolved).toHaveBeenCalledWith(REQUEST.id);
  });

  it("closes on Cancel and calls no resource", async () => {
    const dialog = await open();

    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
    expect(approveMock).not.toHaveBeenCalled();
    expect(rejectMock).not.toHaveBeenCalled();
  });
});
