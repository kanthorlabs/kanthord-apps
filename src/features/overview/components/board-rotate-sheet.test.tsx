import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { listAllCredentials, rotateCredential } from "@/api/resources/credentials";
import type { Credential, Project } from "@/api/types";
import type { CredentialRefusedItem } from "@/lib/fix-attention";

vi.mock("@/api/resources/credentials");
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import { useBoardRotate } from "../use-board-rotate";
import { BoardRotateSheet } from "./board-rotate-sheet";

const PROJECT: Project = {
  id: "prj-1",
  name: "kanthord",
  binding_set_version: 1,
  created_at: 1,
  paused_at: null,
  workspace_directory: "/state/prj-1",
};

const ITEM: CredentialRefusedItem = {
  id: "credential_refused:openai-main",
  kind: "credential_refused",
  group: "fixes",
  project: PROJECT,
  subject: "openai-main",
  at: null,
  cause: "Credential refused",
  nodeIds: ["node_1"],
  projects: [PROJECT],
  count: 1,
  projectCount: 1,
  credential: "openai-main",
  credentials: ["openai-main"],
  nodeName: "Team",
};

function copyOf(holder: string, revision: number, name = "openai-main"): Credential {
  return {
    name,
    platform: "openai",
    holder,
    sealed_to: null,
    sealed_current: true,
    revisions: [
      { id: "old", revision: revision - 1, metadata: null, created_at: 1, ended_at: 2 },
      { id: "live", revision, metadata: null, created_at: 2, ended_at: null },
    ],
  };
}

const reload = vi.fn();
const markActed = vi.fn();
const setDialogOpen = vi.fn();

function Harness() {
  const rotate = useBoardRotate(ITEM, { reload, markActed, setDialogOpen });
  return (
    <>
      <button type="button" onClick={rotate.start}>
        Open rotate
      </button>
      <p>{rotate.missing ?? "ready"}</p>
      <BoardRotateSheet rotate={rotate} />
    </>
  );
}

async function openSheet(): Promise<HTMLElement> {
  await waitFor(() => expect(screen.queryByText("the credential read")).not.toBeInTheDocument());
  await userEvent.click(screen.getByRole("button", { name: "Open rotate" }));
  return screen.findByRole("dialog", { name: "Rotate openai-main" });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listAllCredentials).mockResolvedValue([
    copyOf("server", 5),
    copyOf("mac-studio", 3),
    copyOf("linux-box", 7),
    copyOf("server", 9, "other-key"),
  ]);
});

describe("BoardRotateSheet", () => {
  it("titles the sheet and holds the secret field and Also rotate on with each revision", async () => {
    render(<Harness />);
    const sheet = await openSheet();

    expect(within(sheet).getByText("Rotate openai-main")).toBeVisible();
    const key = within(sheet).getByLabelText("API Key");
    expect(key).toHaveAttribute("autocomplete", "new-password");
    expect(within(sheet).getByText("Also rotate on")).toBeVisible();
    const mac = within(sheet).getByRole("button", { name: "mac-studio (v3)" });
    const linux = within(sheet).getByRole("button", { name: "linux-box (v7)" });
    expect(mac).toHaveAttribute("aria-pressed", "false");
    expect(linux).toHaveAttribute("aria-pressed", "false");
    expect(within(sheet).queryByRole("button", { name: /^server/ })).not.toBeInTheDocument();
    expect(setDialogOpen).toHaveBeenCalledWith("credential_refused:openai-main", "node_1", true);
  });

  it("rotates the server copy at its newest live revision and closes", async () => {
    vi.mocked(rotateCredential).mockResolvedValue(copyOf("server", 6));
    render(<Harness />);
    const sheet = await openSheet();

    await userEvent.type(within(sheet).getByLabelText("API Key"), "sk-2");
    await userEvent.click(within(sheet).getByRole("button", { name: "Rotate secret" }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Rotated openai-main to revision 6."),
    );
    expect(rotateCredential).toHaveBeenCalledTimes(1);
    expect(rotateCredential).toHaveBeenCalledWith(
      "llm",
      "openai-main",
      { expected_revision: 5, secret: { key: "sk-2" } },
      "server",
    );
    expect(markActed).toHaveBeenCalledWith("credential_refused:openai-main");
    expect(reload).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(setDialogOpen).toHaveBeenLastCalledWith(
      "credential_refused:openai-main",
      "node_1",
      false,
    );
  });

  it("rotates each checked holder with its own revision", async () => {
    vi.mocked(rotateCredential).mockResolvedValue(copyOf("server", 6));
    render(<Harness />);
    const sheet = await openSheet();

    await userEvent.type(within(sheet).getByLabelText("API Key"), "sk-2");
    await userEvent.click(within(sheet).getByRole("button", { name: "mac-studio (v3)" }));
    await userEvent.click(within(sheet).getByRole("button", { name: "Rotate secret" }));

    await waitFor(() => expect(rotateCredential).toHaveBeenCalledTimes(2));
    expect(rotateCredential).toHaveBeenCalledWith(
      "llm",
      "openai-main",
      { expected_revision: 5, secret: { key: "sk-2" } },
      "server",
    );
    expect(rotateCredential).toHaveBeenCalledWith(
      "llm",
      "openai-main",
      { expected_revision: 3, secret: { key: "sk-2" } },
      "mac-studio",
    );
  });

  it("asks for the secret before it sends", async () => {
    render(<Harness />);
    const sheet = await openSheet();

    await userEvent.click(within(sheet).getByRole("button", { name: "Rotate secret" }));

    expect(rotateCredential).not.toHaveBeenCalled();
    expect(sheet).toBeVisible();
  });

  it("lists each failed copy after a partial failure and keeps the sheet open", async () => {
    vi.mocked(rotateCredential).mockImplementation((_component, _name, _body, holder) =>
      holder === "mac-studio"
        ? Promise.reject(new ApiError("unavailable", "The holder is offline.", 503))
        : Promise.resolve(copyOf("server", 6)),
    );
    render(<Harness />);
    const sheet = await openSheet();

    await userEvent.type(within(sheet).getByLabelText("API Key"), "sk-2");
    await userEvent.click(within(sheet).getByRole("button", { name: "mac-studio (v3)" }));
    await userEvent.click(within(sheet).getByRole("button", { name: "Rotate secret" }));

    expect(await within(sheet).findByText("Not every copy was rotated.")).toBeVisible();
    expect(
      within(sheet).getByText("mac-studio: not rotated. The holder is offline."),
    ).toBeVisible();
    expect(screen.getByRole("dialog", { name: "Rotate openai-main" })).toBeVisible();
    expect(toast.success).not.toHaveBeenCalled();

    await userEvent.click(within(sheet).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(markActed).toHaveBeenCalledWith("credential_refused:openai-main");
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("shows the conflict and reads the latest", async () => {
    vi.mocked(rotateCredential).mockRejectedValue(
      new ApiError("conflict", "Conflict.", 409, "credential.revision.conflict"),
    );
    render(<Harness />);
    const sheet = await openSheet();

    await userEvent.type(within(sheet).getByLabelText("API Key"), "sk-2");
    await userEvent.click(within(sheet).getByRole("button", { name: "Rotate secret" }));

    expect(await within(sheet).findByText("The secret was not rotated.")).toBeVisible();
    await userEvent.click(within(sheet).getByRole("button", { name: "Read the latest" }));

    await waitFor(() => expect(listAllCredentials).toHaveBeenCalledTimes(2));
    expect(reload).toHaveBeenCalledTimes(1);
    expect(markActed).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("offers no Read the latest for another failure", async () => {
    vi.mocked(rotateCredential).mockRejectedValue(new ApiError("unavailable", "Down.", 503));
    render(<Harness />);
    const sheet = await openSheet();

    await userEvent.type(within(sheet).getByLabelText("API Key"), "sk-2");
    await userEvent.click(within(sheet).getByRole("button", { name: "Rotate secret" }));

    expect(await within(sheet).findByText("The secret was not rotated.")).toBeVisible();
    expect(within(sheet).getByText("Down.")).toBeVisible();
    expect(
      within(sheet).queryByRole("button", { name: "Read the latest" }),
    ).not.toBeInTheDocument();
  });

  it("opens nothing when no server copy exists", async () => {
    vi.mocked(listAllCredentials).mockResolvedValue([copyOf("mac-studio", 3)]);
    render(<Harness />);

    expect(await screen.findByText("a server copy of openai-main")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Open rotate" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
