import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { listProjects } from "@/api/resources/projects";
import { createInvite, revokeInvite } from "@/api/resources/workbench";
import type { Project } from "@/api/types";
import { lockedProjectsOf } from "@/lib/share-invite";
import type { InvitesState } from "../use-invites";
import { ShareDialog } from "./share-dialog";

vi.mock("@/api/resources/projects", () => ({
  listProjects: vi.fn(),
}));

vi.mock("@/api/resources/workbench", () => ({
  createInvite: vi.fn(),
  revokeInvite: vi.fn(),
}));

const SESSION_ID = "workbench_session_1";
const INVITE_TOKEN = "5b0f8f0e-3a54-4a0b-9d5e-2f3f6a1c7a10";
const EXPIRES_AT = Date.parse("2026-10-12T09:00:00.000Z");

const ALPHA_PROJECT = { id: "project_a", name: "Alpha" };
const DANA_INVITE = {
  id: "invite_1",
  invitee_name: "Dana",
  expires_at: EXPIRES_AT,
  projects: [ALPHA_PROJECT],
};

const PROJECTS = [
  { id: "project_b", name: "Beta" },
  { id: "project_a", name: "Alpha" },
  { id: "project_c", name: "Gamma" },
] as Project[];

const listProjectsMock = vi.mocked(listProjects);
const createMock = vi.mocked(createInvite);
const revokeMock = vi.mocked(revokeInvite);
const reload = vi.fn();

function invitesOf(
  project_ids: readonly string[] | null = null,
  items: InvitesState["invites"] = [],
): InvitesState {
  return {
    invites: items,
    status: "ready",
    error: null,
    shared: items.length > 0,
    lockedProjects: lockedProjectsOf(project_ids, items),
    reload,
  };
}

async function selectAll() {
  const button = await screen.findByRole("button", { name: "Select all" });
  await waitFor(() => expect(button).toBeEnabled());
  await userEvent.click(button);
}

async function open(forkTitle: string | null = null, invites = invitesOf()) {
  render(<ShareDialog sessionId={SESSION_ID} forkTitle={forkTitle} invites={invites} />);
  await userEvent.click(screen.getByRole("button", { name: "Share" }));
  return screen.findByRole("dialog", { name: "Share this conversation" });
}

beforeEach(() => {
  listProjectsMock.mockReset();
  listProjectsMock.mockResolvedValue(PROJECTS);
  reload.mockReset();
  createMock.mockReset();
  revokeMock.mockReset();
});

afterEach(() => {
  document.querySelector("base")?.remove();
});

describe("ShareDialog", () => {
  it("states that guests see the whole history and that the link expires in 7 days", async () => {
    const dialog = await open();

    expect(dialog).toHaveTextContent("Guests see the whole history of this conversation.");
    expect(dialog).toHaveTextContent("The link expires in 7 days.");
    expect(dialog).not.toHaveTextContent("carries a summary");
  });

  it("shows the fork line beside the history statement for a fork", async () => {
    const dialog = await open("Account recovery");

    expect(dialog).toHaveTextContent(
      "This conversation carries a summary of Account recovery. Guests see the summary.",
    );
    expect(dialog).toHaveTextContent("Guests see the whole history of this conversation.");
  });

  it.each([
    ["empty", ""],
    ["blank", "   "],
    ["65 characters", "x".repeat(65)],
  ])("keeps Create link disabled for a %s name", async (_label, name) => {
    await open();
    const button = screen.getByRole("button", { name: "Create link" });
    expect(button).toBeDisabled();

    if (name !== "") await userEvent.type(screen.getByLabelText("Invite for (required)"), name);

    expect(button).toBeDisabled();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("enables Create link for a name of 1 to 64 characters", async () => {
    await open();

    await userEvent.type(screen.getByLabelText("Invite for (required)"), "x".repeat(64));
    await selectAll();

    expect(screen.getByRole("button", { name: "Create link" })).toBeEnabled();
  });

  it("shows the link once, with the page origin and the name in the fragment", async () => {
    createMock.mockResolvedValue({
      id: "invite_1",
      session_id: SESSION_ID,
      invitee_name: "Dana Lee & Co",
      expires_at: EXPIRES_AT,
      projects: [],
      invite_token: INVITE_TOKEN,
    });
    await open();

    await userEvent.type(screen.getByLabelText("Invite for (required)"), "Dana Lee & Co");
    await selectAll();
    await userEvent.click(screen.getByRole("button", { name: "Create link" }));

    const link = await screen.findByLabelText("Invite link (copy now, shown once)");
    expect(createMock).toHaveBeenCalledWith(SESSION_ID, {
      invitee_name: "Dana Lee & Co",
      project_ids: ["project_a", "project_b", "project_c"],
    });
    expect(link).toHaveValue(
      `${window.location.origin}/join/${INVITE_TOKEN}#name=Dana%20Lee%20%26%20Co`,
    );
    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("shows the visible label of the link field after Create link", async () => {
    createMock.mockResolvedValue({
      id: "invite_1",
      session_id: SESSION_ID,
      invitee_name: "Dana",
      expires_at: EXPIRES_AT,
      projects: [],
      invite_token: INVITE_TOKEN,
    });
    const dialog = await open();
    await userEvent.type(screen.getByLabelText("Invite for (required)"), "Dana");
    await selectAll();
    expect(within(dialog).queryByText("Invite link (copy now, shown once)")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Create link" }));

    const label = await within(dialog).findByText("Invite link (copy now, shown once)");
    expect(label.tagName).toBe("LABEL");
    expect(label).toBeVisible();
    expect(screen.getByLabelText("Invite link (copy now, shown once)")).toBe(
      document.getElementById(label.getAttribute("for") ?? ""),
    );
  });

  it("puts the base path between the origin and join", async () => {
    const base = document.createElement("base");
    base.setAttribute("href", "/dash/");
    document.head.append(base);
    createMock.mockResolvedValue({
      id: "invite_1",
      session_id: SESSION_ID,
      invitee_name: "Dana",
      expires_at: EXPIRES_AT,
      projects: [],
      invite_token: INVITE_TOKEN,
    });
    await open();

    await userEvent.type(screen.getByLabelText("Invite for (required)"), "Dana");
    await selectAll();
    await userEvent.click(screen.getByRole("button", { name: "Create link" }));

    const link = (await screen.findByLabelText(
      "Invite link (copy now, shown once)",
    )) as HTMLInputElement;
    expect(link.value.startsWith(`${window.location.origin}/dash/join/`)).toBe(true);
    expect(link.value.endsWith("#name=Dana")).toBe(true);
  });

  it("shows one error line under Create link and a red border when the call fails", async () => {
    createMock.mockRejectedValue(
      new ApiError(
        "malformed",
        "The invitee name is not valid.",
        400,
        "workbench.invite.name_invalid",
      ),
    );
    const dialog = await open();

    await userEvent.type(screen.getByLabelText("Invite for (required)"), "Dana");
    await selectAll();
    await userEvent.click(screen.getByRole("button", { name: "Create link" }));

    const line = await screen.findByRole("alert");
    expect(line).toHaveTextContent("workbench.invite.name_invalid The invitee name is not valid.");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(dialog).toHaveClass("border-destructive");
    expect(screen.queryByLabelText("Invite link (copy now, shown once)")).toBeNull();
  });

  it("keeps Create link disabled with no project and shows the hint", async () => {
    const dialog = await open();

    await userEvent.type(screen.getByLabelText("Invite for (required)"), "Dana");

    expect(screen.getByRole("button", { name: "Create link" })).toBeDisabled();
    expect(dialog).toHaveTextContent("Select at least one project.");
    await selectAll();
    expect(screen.getByRole("button", { name: "Create link" })).toBeEnabled();
    expect(dialog).not.toHaveTextContent("Select at least one project.");
  });

  it("labels the field and its search input", async () => {
    await open();

    expect(screen.getByText("Projects (required, 1 to 50)")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search projects…")).toBeInTheDocument();
  });

  it("keeps the field label in the locked state", async () => {
    const dialog = await open(null, invitesOf(["project_a"], [DANA_INVITE]));

    expect(within(dialog).getByText("Projects (required, 1 to 50)")).toBeInTheDocument();
  });

  it("keeps Create link disabled and shows the hint with 51 projects", async () => {
    listProjectsMock.mockResolvedValue(
      Array.from({ length: 51 }, (_, index) => ({
        id: `project_${String(index).padStart(2, "0")}`,
        name: `Project ${String(index).padStart(2, "0")}`,
      })) as Project[],
    );
    const dialog = await open();

    await userEvent.type(screen.getByLabelText("Invite for (required)"), "Dana");
    await selectAll();

    expect(dialog).toHaveTextContent("Select at most 50 projects.");
    expect(screen.getByRole("button", { name: "Create link" })).toBeDisabled();
  });

  it("selects every listed project with Select all and shows the chips by name", async () => {
    const dialog = await open();

    await selectAll();

    for (const name of ["Alpha", "Beta", "Gamma"]) {
      expect(within(dialog).getByText(name)).toBeInTheDocument();
    }
  });

  it("shows the locked set and the lock line with a live invite", async () => {
    const dialog = await open(
      null,
      invitesOf(
        ["project_a", "project_x"],
        [
          {
            id: "invite_1",
            invitee_name: "Dana",
            expires_at: EXPIRES_AT,
            projects: [
              { id: "project_a", name: "Alpha" },
              { id: "project_x", name: null },
            ],
          },
        ],
      ),
    );

    const locked = within(dialog).getByRole("list", { name: "Projects of the live invites" });
    expect(within(locked).getByText("Alpha")).toBeInTheDocument();
    expect(within(locked).getByText("project_x")).toBeInTheDocument();
    expect(dialog).toHaveTextContent(
      "Every invite of this conversation shares these projects. Revoke every invite to change them.",
    );
    expect(within(dialog).queryByRole("button", { name: "Select all" })).toBeNull();
    expect(within(dialog).getByText("Projects: Alpha, project_x")).toBeInTheDocument();
  });

  it("states the scope sentence and the history warning", async () => {
    const dialog = await open("Account recovery");

    expect(dialog).toHaveTextContent(
      "A guest who mentions an agent reads and acts only on the selected projects. Guest runs read the bindings and agent configurations of these projects, credential names included, and no credential list, worker catalog, cooldown or health data.",
    );
    expect(dialog).toHaveTextContent(
      "Guests see every answer in this conversation, including your own runs.",
    );
    expect(dialog).toHaveTextContent(
      "Agents in guest runs read the earlier answers too. Share a new conversation to keep other projects out.",
    );
    expect(dialog).toHaveTextContent(
      "This conversation carries a summary of Account recovery. Guests see the summary.",
    );
  });

  it.each([
    ["project_invalid", "malformed", 400, "workbench.invite.project_invalid"],
    ["scope_mismatch", "conflict", 409, "workbench.invite.scope_mismatch"],
  ] as const)(
    "shows the %s error line under the Projects field",
    async (_name, code, status, detail) => {
      createMock.mockRejectedValue(new ApiError(code, "The projects are refused.", status, detail));
      await open();

      await userEvent.type(screen.getByLabelText("Invite for (required)"), "Dana");
      await selectAll();
      await userEvent.click(screen.getByRole("button", { name: "Create link" }));

      const line = await screen.findByRole("alert");
      expect(line).toHaveTextContent(`${detail} The projects are refused.`);
      expect(screen.getAllByRole("alert")).toHaveLength(1);
    },
  );

  it("closes the dialog with Done", async () => {
    const dialog = await open();

    await userEvent.click(within(dialog).getByRole("button", { name: "Done" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Share this conversation" })).toBeNull(),
    );
  });

  it("lists each live invite with its name, its expiry and Revoke", async () => {
    await open(
      null,
      invitesOf(
        ["project_a"],
        [
          DANA_INVITE,
          {
            id: "invite_2",
            invitee_name: "Sam",
            expires_at: EXPIRES_AT + 3_600_000,
            projects: [ALPHA_PROJECT],
          },
        ],
      ),
    );

    const list = screen.getByRole("region", { name: "Invites" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(within(list).getByText("Dana")).toBeInTheDocument();
    expect(within(list).getByText("Expires 2026-10-12 09:00 UTC")).toBeInTheDocument();
    expect(within(list).getByText("Sam")).toBeInTheDocument();
    expect(within(list).getByText("Expires 2026-10-12 10:00 UTC")).toBeInTheDocument();
    expect(within(list).getByRole("button", { name: "Revoke Dana" })).toBeInTheDocument();
    expect(within(list).getByRole("button", { name: "Revoke Sam" })).toBeInTheDocument();
  });

  it("shows the projects of each live invite and the id of a null name", async () => {
    await open(
      null,
      invitesOf(
        ["project_a", "project_x"],
        [
          {
            id: "invite_1",
            invitee_name: "Dana",
            expires_at: EXPIRES_AT,
            projects: [
              { id: "project_a", name: "Alpha" },
              { id: "project_x", name: null },
            ],
          },
        ],
      ),
    );

    const list = screen.getByRole("region", { name: "Invites" });
    expect(within(list).getByText("Projects: Alpha, project_x")).toBeInTheDocument();
  });

  it("revokes an invite and reads the list again", async () => {
    revokeMock.mockResolvedValue({ id: "invite_1" });
    await open(null, invitesOf(["project_a"], [DANA_INVITE]));

    await userEvent.click(screen.getByRole("button", { name: "Revoke Dana" }));
    expect(revokeMock).not.toHaveBeenCalled();
    const confirm = await screen.findByRole("alertdialog");
    expect(confirm).toHaveTextContent("Revoke the invite of Dana?");
    await userEvent.click(within(confirm).getByRole("button", { name: "Revoke invite" }));

    await waitFor(() => expect(revokeMock).toHaveBeenCalledWith("invite_1"));
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  it("keeps the invite when the confirmation is cancelled", async () => {
    await open(null, invitesOf(["project_a"], [DANA_INVITE]));

    await userEvent.click(screen.getByRole("button", { name: "Revoke Dana" }));
    const confirm = await screen.findByRole("alertdialog");
    await userEvent.click(within(confirm).getByRole("button", { name: "Keep the invite" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(revokeMock).not.toHaveBeenCalled();
  });

  it("shows one error line in the row of an invite that fails to revoke", async () => {
    revokeMock.mockRejectedValue(
      new ApiError("not_found", "The invite does not exist.", 404, "workbench.invite.not_found"),
    );
    await open(null, invitesOf(["project_a"], [DANA_INVITE]));

    await userEvent.click(screen.getByRole("button", { name: "Revoke Dana" }));
    const confirm = await screen.findByRole("alertdialog");
    await userEvent.click(within(confirm).getByRole("button", { name: "Revoke invite" }));

    const line = await screen.findByRole("alert");
    expect(line).toHaveTextContent("workbench.invite.not_found The invite does not exist.");
    const list = screen.getByRole("region", { name: "Invites" });
    expect(within(within(list).getByRole("listitem")).getByRole("alert")).toBe(line);
    expect(reload).not.toHaveBeenCalled();
  });
});
