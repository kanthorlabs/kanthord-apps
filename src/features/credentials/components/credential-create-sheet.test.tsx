import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as credentialsApi from "@/api/resources/credentials";

vi.mock("@/api/resources/credentials");

import { CredentialCreateSheet } from "./credential-create-sheet";

const SESSION = {
  session_id: "login_session_01J9ZQ4XKM3B6V8N2R5T7W0YAC",
  address: "https://github.com/login/device",
  code: "ABCD-1234",
  expires_at: Date.UTC(2026, 9, 4, 7, 15),
};

function mount(onClose: () => void) {
  render(
    <MemoryRouter>
      <CredentialCreateSheet component="llm" open onClose={onClose} onCreated={vi.fn()} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(credentialsApi.listCredentialPlatforms).mockResolvedValue({
    items: [
      {
        platform: "github-copilot",
        secret_shape: "oauth",
        login_modes: ["device"],
        metadata_fields: [],
        verifiable: true,
      },
    ],
  });
  vi.mocked(credentialsApi.startCredentialLogin).mockResolvedValue(SESSION);
  vi.mocked(credentialsApi.readCredentialLoginStatus).mockResolvedValue({
    session_id: SESSION.session_id,
    state: "pending",
    last_message: null,
    failure_reason: null,
  });
});

describe("CredentialCreateSheet", () => {
  it("keeps the sheet open and offers no close button while a sign-in is pending", async () => {
    const onClose = vi.fn();
    mount(onClose);

    await userEvent.type(await screen.findByLabelText("Name"), "copilot");
    const platform = screen.getByRole("combobox", { name: "Platform" });
    await userEvent.clear(platform);
    await userEvent.type(platform, "github-copilot");
    await userEvent.click(await screen.findByRole("option", { name: "github-copilot" }));
    await userEvent.click(screen.getByRole("button", { name: "Start sign-in" }));

    expect(await screen.findByText("ABCD-1234")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    await userEvent.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText("ABCD-1234")).toBeTruthy();
  });
});
