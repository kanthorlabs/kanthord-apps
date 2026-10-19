import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type * as Sonner from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as credentialsApi from "@/api/resources/credentials";
import type { Credential } from "@/api/types";

vi.mock("@/api/resources/credentials");
vi.mock("sonner", async (importOriginal) => ({
  ...(await importOriginal<typeof Sonner>()),
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import { toast } from "sonner";
import { SshKeySheet } from "./ssh-key-sheet";

const KEY = {
  public_key: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIA kanthord-deploy-atlas",
  fingerprint: "SHA256:uNiVztksCsDhcc0u9e8BujQXVUpKZIDTMczCvj3tD2s",
};

const CREATED: Credential = {
  name: "deploy-atlas",
  platform: "ssh",
  revisions: [
    {
      id: "credential_01J9ZQ4XKM3B6V8N2R5T7W0YAC",
      revision: 1,
      metadata: KEY,
      created_at: 1,
      ended_at: null,
    },
  ],
};

const DEPLOY_HINT =
  "One deploy key serves one repository. Create one SSH key for each repository. An account SSH key serves every repository of the account and gives the server write access to all of them.";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(credentialsApi.createSshKey).mockResolvedValue(CREATED);
});

afterEach(() => {
  Reflect.deleteProperty(navigator, "clipboard");
});

function mount() {
  const onClose = vi.fn();
  const onDone = vi.fn();
  render(<SshKeySheet onClose={onClose} onDone={onDone} />);
  return { onClose, onDone };
}

describe("SshKeySheet", () => {
  it("asks for the name only and keeps Create disabled until the name holds a value", async () => {
    mount();

    const form = screen.getByRole("form", { name: "Create SSH key" });
    expect(within(form).getAllByRole("textbox")).toHaveLength(1);
    expect(within(form).getByRole("button", { name: "Create SSH key" })).toBeDisabled();
    expect(within(form).getByText("Fill Name to create.")).toBeTruthy();
    expect(within(form).getByText(DEPLOY_HINT)).toBeTruthy();

    await userEvent.type(within(form).getByLabelText("Name"), "deploy-atlas");
    expect(within(form).getByRole("button", { name: "Create SSH key" })).toBeEnabled();
  });

  it("shows the public key with Copy, the fingerprint, the deploy key steps and the hint", async () => {
    const { onDone } = mount();

    await userEvent.type(screen.getByLabelText("Name"), "deploy-atlas");
    await userEvent.click(screen.getByRole("button", { name: "Create SSH key" }));

    const sheet = await screen.findByRole("dialog", { name: "SSH key deploy-atlas" });
    expect(within(sheet).getByText(KEY.public_key)).toBeTruthy();
    expect(within(sheet).getByText(KEY.fingerprint)).toBeTruthy();
    expect(
      within(sheet).getByText("In the repository, open Settings > Deploy keys > Add deploy key."),
    ).toBeTruthy();
    expect(within(sheet).getByText("Paste the key.")).toBeTruthy();
    expect(within(sheet).getByText("Select Allow write access.")).toBeTruthy();
    expect(within(sheet).getByText(DEPLOY_HINT)).toBeTruthy();

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await userEvent.click(within(sheet).getByRole("button", { name: "Copy public key" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Copied the public key."));
    expect(writeText).toHaveBeenCalledWith(KEY.public_key);

    await userEvent.click(within(sheet).getByRole("button", { name: "Done" }));
    expect(onDone).toHaveBeenCalledWith("deploy-atlas");
  });

  it("states the refusal of the server and keeps the name", async () => {
    vi.mocked(credentialsApi.createSshKey).mockRejectedValue(
      new (await import("@/api/errors")).ApiError(
        "conflict",
        "Credential name already exists.",
        409,
        "credential.name.conflict",
      ),
    );
    mount();

    await userEvent.type(screen.getByLabelText("Name"), "atlas-ssh");
    await userEvent.click(screen.getByRole("button", { name: "Create SSH key" }));

    expect(await screen.findByText("The SSH key was not created.")).toBeTruthy();
    expect(screen.getByLabelText("Name")).toHaveValue("atlas-ssh");
  });

  it("shows Creating while the create is in flight", async () => {
    vi.mocked(credentialsApi.createSshKey).mockReturnValue(new Promise(() => undefined));
    mount();

    await userEvent.type(screen.getByLabelText("Name"), "deploy-atlas");
    await userEvent.click(screen.getByRole("button", { name: "Create SSH key" }));

    expect(screen.getByRole("button", { name: "Creating…" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Create SSH key" })).toBeNull();
  });

  it("closes without a create on Escape", async () => {
    const { onClose, onDone } = mount();

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onDone).not.toHaveBeenCalled();
  });
});
