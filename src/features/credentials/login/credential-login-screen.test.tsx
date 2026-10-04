import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type * as Sonner from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as credentialsApi from "@/api/resources/credentials";
import type { CredentialLoginSession } from "@/api/types";

vi.mock("@/api/resources/credentials");
vi.mock("sonner", async (importOriginal) => ({
  ...(await importOriginal<typeof Sonner>()),
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import { CredentialLoginScreen } from "./credential-login-screen";

const SESSION: CredentialLoginSession = {
  sessionId: "login_session_01J9ZQ4XKM3B6V8N2R5T7W0YAC",
  address: "https://github.com/login/device",
  code: "ABCD-1234",
  expiresAt: Date.UTC(2026, 9, 4, 7, 15),
};

function mount() {
  return render(
    <MemoryRouter initialEntries={["/credentials/login"]}>
      <Routes>
        <Route path="/credentials/login" element={<CredentialLoginScreen />} />
        <Route path="/credentials/:credentialName" element={<p>Credential view</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function start(name: string) {
  await userEvent.type(screen.getByLabelText("Credential name"), name);
  await userEvent.click(screen.getByRole("button", { name: "Start sign-in" }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CredentialLoginScreen", () => {
  it("starts a session and shows its address, code and expiry", async () => {
    vi.mocked(credentialsApi.startCredentialLogin).mockResolvedValue(SESSION);
    vi.mocked(credentialsApi.readCredentialLoginStatus).mockResolvedValue({
      sessionId: SESSION.sessionId,
      state: "pending",
      lastMessage: null,
      failureReason: null,
    });
    mount();

    await start("copilot");

    expect(await screen.findByText("ABCD-1234")).toBeTruthy();
    expect(screen.getByRole("link", { name: SESSION.address })).toBeTruthy();
    expect(screen.getByText("2026-10-04 07:15 UTC")).toBeTruthy();
    expect(credentialsApi.startCredentialLogin).toHaveBeenCalledWith({
      platform: "github-copilot",
      name: "copilot",
    });
  });

  it("sends the selected mode", async () => {
    vi.mocked(credentialsApi.startCredentialLogin).mockResolvedValue(SESSION);
    mount();

    await userEvent.click(screen.getByRole("combobox", { name: "Mode" }));
    await userEvent.click(await screen.findByRole("option", { name: "Device code" }));
    await start("copilot");

    expect(credentialsApi.startCredentialLogin).toHaveBeenCalledWith({
      platform: "github-copilot",
      name: "copilot",
      mode: "device",
    });
  });

  it("polls the status until the sign-in completes", async () => {
    vi.mocked(credentialsApi.startCredentialLogin).mockResolvedValue(SESSION);
    vi.mocked(credentialsApi.readCredentialLoginStatus).mockResolvedValue({
      sessionId: SESSION.sessionId,
      state: "completed",
      lastMessage: null,
      failureReason: null,
    });
    mount();

    await start("copilot");

    expect(
      await screen.findByRole("button", { name: "Open copilot" }, { timeout: 4000 }),
    ).toBeTruthy();
    expect(credentialsApi.readCredentialLoginStatus).toHaveBeenCalledWith(SESSION.sessionId);
  });

  it("supplies a pasted code and clears the field", async () => {
    vi.mocked(credentialsApi.startCredentialLogin).mockResolvedValue(SESSION);
    vi.mocked(credentialsApi.readCredentialLoginStatus).mockResolvedValue({
      sessionId: SESSION.sessionId,
      state: "pending",
      lastMessage: null,
      failureReason: null,
    });
    vi.mocked(credentialsApi.submitCredentialLoginCode).mockResolvedValue({
      sessionId: SESSION.sessionId,
    });
    mount();

    await start("copilot");
    const field = await screen.findByLabelText("Code or redirect URL");
    await userEvent.type(field, "http://localhost:1455/callback?code=1");
    await userEvent.click(screen.getByRole("button", { name: "Send code" }));

    expect(credentialsApi.submitCredentialLoginCode).toHaveBeenCalledWith(
      SESSION.sessionId,
      "http://localhost:1455/callback?code=1",
    );
    expect((field as HTMLInputElement).value).toBe("");
  });

  it("explains a pending sign-in", async () => {
    vi.mocked(credentialsApi.startCredentialLogin).mockRejectedValue(
      new ApiError("conflict", "Pending.", 409, "credential.login.pending"),
    );
    mount();

    await start("copilot");

    expect(
      await screen.findByText(/Another GitHub Copilot sign-in of yours is pending/),
    ).toBeTruthy();
  });
});
