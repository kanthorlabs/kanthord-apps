import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { createInvite, revokeInvite } from "@/api/resources/workbench";
import type { InvitesState } from "../use-invites";
import { ShareDialog } from "./share-dialog";

vi.mock("@/api/resources/workbench", () => ({
  createInvite: vi.fn(),
  revokeInvite: vi.fn(),
}));

const SESSION_ID = "workbench_session_1";
const INVITE_TOKEN = "5b0f8f0e-3a54-4a0b-9d5e-2f3f6a1c7a10";
const EXPIRES_AT = Date.parse("2026-10-12T09:00:00.000Z");

const createMock = vi.mocked(createInvite);
const revokeMock = vi.mocked(revokeInvite);
const reload = vi.fn();

function invitesOf(items: InvitesState["invites"] = []): InvitesState {
  return {
    invites: items,
    status: "ready",
    error: null,
    shared: items.length > 0,
    reload,
  };
}

async function open(forkTitle: string | null = null, invites = invitesOf()) {
  render(<ShareDialog sessionId={SESSION_ID} forkTitle={forkTitle} invites={invites} />);
  await userEvent.click(screen.getByRole("button", { name: "Share" }));
  return screen.findByRole("dialog", { name: "Share this conversation" });
}

beforeEach(() => {
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

    if (name !== "") await userEvent.type(screen.getByLabelText("Invitee name"), name);

    expect(button).toBeDisabled();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("enables Create link for a name of 1 to 64 characters", async () => {
    await open();

    await userEvent.type(screen.getByLabelText("Invitee name"), "x".repeat(64));

    expect(screen.getByRole("button", { name: "Create link" })).toBeEnabled();
  });

  it("shows the link once, with the page origin and the name in the fragment", async () => {
    createMock.mockResolvedValue({
      id: "invite_1",
      session_id: SESSION_ID,
      invitee_name: "Dana Lee & Co",
      expires_at: EXPIRES_AT,
      invite_token: INVITE_TOKEN,
    });
    await open();

    await userEvent.type(screen.getByLabelText("Invitee name"), "Dana Lee & Co");
    await userEvent.click(screen.getByRole("button", { name: "Create link" }));

    const link = await screen.findByLabelText("Invite link");
    expect(createMock).toHaveBeenCalledWith(SESSION_ID, { invitee_name: "Dana Lee & Co" });
    expect(link).toHaveValue(
      `${window.location.origin}/join/${INVITE_TOKEN}#name=Dana%20Lee%20%26%20Co`,
    );
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
    expect(reload).toHaveBeenCalledTimes(1);
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
      invite_token: INVITE_TOKEN,
    });
    await open();

    await userEvent.type(screen.getByLabelText("Invitee name"), "Dana");
    await userEvent.click(screen.getByRole("button", { name: "Create link" }));

    const link = (await screen.findByLabelText("Invite link")) as HTMLInputElement;
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

    await userEvent.type(screen.getByLabelText("Invitee name"), "Dana");
    await userEvent.click(screen.getByRole("button", { name: "Create link" }));

    const line = await screen.findByRole("alert");
    expect(line).toHaveTextContent("workbench.invite.name_invalid The invitee name is not valid.");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(dialog).toHaveClass("border-destructive");
    expect(screen.queryByLabelText("Invite link")).toBeNull();
  });

  it("lists each live invite with its name, its expiry and Revoke", async () => {
    await open(
      null,
      invitesOf([
        { id: "invite_1", invitee_name: "Dana", expires_at: EXPIRES_AT },
        { id: "invite_2", invitee_name: "Sam", expires_at: EXPIRES_AT + 3_600_000 },
      ]),
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

  it("revokes an invite and reads the list again", async () => {
    revokeMock.mockResolvedValue({ id: "invite_1" });
    await open(null, invitesOf([{ id: "invite_1", invitee_name: "Dana", expires_at: EXPIRES_AT }]));

    await userEvent.click(screen.getByRole("button", { name: "Revoke Dana" }));

    await waitFor(() => expect(revokeMock).toHaveBeenCalledWith("invite_1"));
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  it("shows one error line in the row of an invite that fails to revoke", async () => {
    revokeMock.mockRejectedValue(
      new ApiError("not_found", "The invite does not exist.", 404, "workbench.invite.not_found"),
    );
    await open(null, invitesOf([{ id: "invite_1", invitee_name: "Dana", expires_at: EXPIRES_AT }]));

    await userEvent.click(screen.getByRole("button", { name: "Revoke Dana" }));

    const line = await screen.findByRole("alert");
    expect(line).toHaveTextContent("workbench.invite.not_found The invite does not exist.");
    expect(within(screen.getByRole("listitem")).getByRole("alert")).toBe(line);
    expect(reload).not.toHaveBeenCalled();
  });
});
