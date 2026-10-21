import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Credential } from "@/api/types";
import { CredentialCombobox } from "./credential-combobox";

const FINGERPRINT = "SHA256:SS5y+4FAdGZpIGkhURFS2VSlcK1tTrWmGk8Az16VdMs";

const ATLAS_SSH: Credential = {
  name: "atlas-ssh",
  platform: "ssh",
  holder: "server",
  sealed_to: null,
  sealed_current: true,
  revisions: [
    {
      id: "rev_1",
      revision: 1,
      metadata: { public_key: "ssh-ed25519 AAAAold kanthord-atlas-ssh", fingerprint: "SHA256:old" },
      created_at: 1,
      ended_at: 2,
    },
    {
      id: "rev_2",
      revision: 2,
      metadata: { public_key: "ssh-ed25519 AAAAnew kanthord-atlas-ssh", fingerprint: FINGERPRINT },
      created_at: 2,
      ended_at: null,
    },
  ],
};

const GITHUB_MAIN: Credential = {
  name: "github-main",
  platform: "github",
  holder: "server",
  sealed_to: null,
  sealed_current: true,
  revisions: [],
};

function mount(credentials: readonly Credential[], newLabel?: string) {
  render(
    <CredentialCombobox
      id="field"
      label="SSH credential"
      credentials={credentials}
      value=""
      error={undefined}
      newLabel={newLabel}
      onChange={vi.fn()}
      onNew={vi.fn()}
    />,
  );
  return screen.getByRole("combobox", { name: "SSH credential" });
}

describe("CredentialCombobox", () => {
  it("names the New action in the empty text of an empty list", async () => {
    const input = mount([], "New SSH credential");
    expect(screen.getByRole("button", { name: "New SSH credential" })).toBeTruthy();
    await userEvent.click(input);

    expect(await screen.findByText("No credential exists. Use New SSH credential.")).toBeTruthy();
  });

  it("names New credential in the empty text by default", async () => {
    await userEvent.click(mount([]));

    expect(await screen.findByText("No credential exists. Use New credential.")).toBeTruthy();
  });

  it("states a filter miss apart from an empty list", async () => {
    await userEvent.type(mount([GITHUB_MAIN]), "zzz");

    expect(await screen.findByText("No credential matches.")).toBeTruthy();
    expect(screen.queryByText(/No credential exists/)).toBeNull();
  });

  it("lists an SSH credential with its newest live revision and its fingerprint", async () => {
    await userEvent.click(mount([ATLAS_SSH], "New SSH credential"));

    const option = await screen.findByRole("option", { name: /atlas-ssh \(v2\)/ });
    expect(within(option).getByText(FINGERPRINT)).toBeTruthy();
  });

  it("keeps the platform label of another credential", async () => {
    await userEvent.click(mount([GITHUB_MAIN]));

    expect(await screen.findByRole("option", { name: "github-main (github)" })).toBeTruthy();
  });
});
