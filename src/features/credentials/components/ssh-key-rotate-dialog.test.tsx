import { act, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type * as Sonner from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as credentialsApi from "@/api/resources/credentials";
import type { Credential, RepositoryCredential } from "@/api/types";
import { Button } from "@/components/ui/button";

vi.mock("@/api/resources/credentials");
vi.mock("sonner", async (importOriginal) => ({
  ...(await importOriginal<typeof Sonner>()),
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import { toast } from "sonner";
import { useSshKeyRotate } from "../use-ssh-key-rotate";
import { SshKeyRotateDialog } from "./ssh-key-rotate-dialog";

const OLD_KEY = {
  public_key: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOld kanthord-atlas-ssh",
  fingerprint: "SHA256:oldoldoldoldoldoldoldoldoldoldoldoldoldoldo",
};
const NEW_KEY = {
  public_key: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINew kanthord-atlas-ssh",
  fingerprint: "SHA256:newnewnewnewnewnewnewnewnewnewnewnewnewnewn",
};

const ATLAS_SSH: Credential = {
  name: "atlas-ssh",
  platform: "ssh",
  revisions: [
    {
      id: "credential_01J9ZQ4XKM3B6V8N2R5T7W0002",
      revision: 1,
      metadata: OLD_KEY,
      created_at: 1,
      ended_at: null,
    },
  ],
};

const ROTATED: Credential = {
  ...ATLAS_SSH,
  revisions: [
    {
      id: "credential_01J9ZQ4XKM3B6V8N2R5T7W0003",
      revision: 2,
      metadata: NEW_KEY,
      created_at: 2,
      ended_at: null,
    },
    ...ATLAS_SSH.revisions,
  ],
};

const WITH_BINDINGS: RepositoryCredential = {
  ...ATLAS_SSH,
  bindings: [
    { project_id: "project_atlas", project_name: "atlas", binding_id: "binding_1", name: "source" },
    { project_id: "project_orbit", project_name: "orbit", binding_id: "binding_2", name: "mirror" },
  ],
};

function Harness({ reload }: { readonly reload: () => void }) {
  const rotate = useSshKeyRotate(ATLAS_SSH, reload);
  return (
    <>
      <Button onClick={rotate.start}>Start</Button>
      <SshKeyRotateDialog name="atlas-ssh" rotate={rotate} />
    </>
  );
}

function mount() {
  const reload = vi.fn();
  render(<Harness reload={reload} />);
  return { reload };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(credentialsApi.readCredential).mockResolvedValue(WITH_BINDINGS);
  vi.mocked(credentialsApi.rotateSshKey).mockResolvedValue(ROTATED);
});

afterEach(() => {
  Reflect.deleteProperty(navigator, "clipboard");
});

describe("SshKeyRotateDialog", () => {
  it("lists the bindings that name the credential and states the key_refused window", async () => {
    mount();
    await userEvent.click(screen.getByRole("button", { name: "Start" }));

    const dialog = await screen.findByRole("alertdialog", { name: "Rotate the key of atlas-ssh?" });
    const list = await within(dialog).findByRole("list", { name: "Bindings of atlas-ssh" });
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["source of project atlas", "mirror of project orbit"]);
    expect(within(dialog).getByText(/answers key_refused/)).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Keep current key" })).toBeTruthy();
    expect(credentialsApi.readCredential).toHaveBeenCalledWith("repository", "atlas-ssh");
    expect(credentialsApi.rotateSshKey).not.toHaveBeenCalled();
  });

  it("rotates at the newest revision and shows the new key with the four steps", async () => {
    const { reload } = mount();
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    const dialog = await screen.findByRole("alertdialog");
    await within(dialog).findByRole("list", { name: "Bindings of atlas-ssh" });

    await userEvent.click(within(dialog).getByRole("button", { name: "Rotate key" }));

    expect(credentialsApi.rotateSshKey).toHaveBeenCalledWith("atlas-ssh", { expected_revision: 1 });
    const result = await screen.findByRole("alertdialog", { name: "New key of atlas-ssh" });
    expect(within(result).getByText(NEW_KEY.public_key)).toBeTruthy();
    expect(within(result).getByText(NEW_KEY.fingerprint)).toBeTruthy();
    expect(
      within(result)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      "source of project atlas",
      "mirror of project orbit",
      "Add the new public key as a deploy key with write access.",
      "Verify each binding.",
      "Wait until revision 1 shows an end time.",
      "Delete the old deploy key at GitHub.",
    ]);
    expect(toast.success).toHaveBeenCalledWith("Rotated the key of atlas-ssh to revision 2.");

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await userEvent.click(within(result).getByRole("button", { name: "Copy public key" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(NEW_KEY.public_key));

    expect(reload).not.toHaveBeenCalled();
    await userEvent.click(within(result).getByRole("button", { name: "Done" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("states that Keep current key changes nothing", async () => {
    mount();
    await userEvent.click(screen.getByRole("button", { name: "Start" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText(
        "Keep current key changes nothing. Rotate when you can add the new deploy key.",
      ),
    ).toBeTruthy();
    expect(within(dialog).queryByText(/stays live/)).toBeNull();
  });

  it("rotates once while a rotate is in flight", () => {
    vi.mocked(credentialsApi.rotateSshKey).mockReturnValue(new Promise(() => undefined));
    const { result } = renderHook(() => useSshKeyRotate(ATLAS_SSH, vi.fn()));

    act(() => result.current.start());
    act(() => result.current.confirm());
    act(() => result.current.confirm());

    expect(credentialsApi.rotateSshKey).toHaveBeenCalledTimes(1);
  });

  it("names the computed revision in the toast when the answer holds no live revision", async () => {
    vi.mocked(credentialsApi.rotateSshKey).mockResolvedValue({
      ...ATLAS_SSH,
      revisions: ATLAS_SSH.revisions.map((revision) => ({ ...revision, ended_at: 5 })),
    });
    const { result } = renderHook(() => useSshKeyRotate(ATLAS_SSH, vi.fn()));

    act(() => result.current.start());
    act(() => result.current.confirm());

    await waitFor(() => expect(result.current.rotated?.revision).toBe(2));
    expect(toast.success).toHaveBeenCalledWith("Rotated the key of atlas-ssh to revision 2.");
  });

  it("states that no binding names the credential", async () => {
    vi.mocked(credentialsApi.readCredential).mockResolvedValue({ ...ATLAS_SSH, bindings: [] });
    mount();
    await userEvent.click(screen.getByRole("button", { name: "Start" }));

    expect(await screen.findByText(/No binding names/)).toBeTruthy();
  });

  it("offers a retry when the bindings cannot be read", async () => {
    vi.mocked(credentialsApi.readCredential)
      .mockRejectedValueOnce(new ApiError("unavailable", "The daemon did not answer.", 503))
      .mockResolvedValue(WITH_BINDINGS);
    mount();
    await userEvent.click(screen.getByRole("button", { name: "Start" }));

    await userEvent.click(await screen.findByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("list", { name: "Bindings of atlas-ssh" })).toBeTruthy();
  });

  it("offers a reload when the expected revision is stale", async () => {
    vi.mocked(credentialsApi.rotateSshKey).mockRejectedValue(
      new ApiError("conflict", "Stale.", 409, "credential.revision.conflict"),
    );
    const { reload } = mount();
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    const dialog = await screen.findByRole("alertdialog");

    await userEvent.click(within(dialog).getByRole("button", { name: "Rotate key" }));

    expect(await within(dialog).findByText("The credential changed.")).toBeTruthy();
    await userEvent.click(within(dialog).getByRole("button", { name: "Reload" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
