import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type * as Sonner from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as credentialsApi from "@/api/resources/credentials";
import type { Credential } from "@/api/types";

vi.mock("@/api/resources/credentials");
vi.mock("sonner", async (importOriginal) => ({
  ...(await importOriginal<typeof Sonner>()),
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import { CredentialFormScreen } from "./credential-form-screen";

const ROUTER: Credential = {
  name: "router",
  platform: "openai-compatible",
  revisions: [
    {
      id: "credential_01J9ZQ4XKM3B6V8N2R5T7W0YAE",
      revision: 1,
      metadata: { baseUrl: "https://openrouter.ai/api/v1", models: [] },
      createdAt: 1,
      endedAt: null,
    },
  ],
};

function mount() {
  return render(
    <MemoryRouter initialEntries={["/credentials/new"]}>
      <Routes>
        <Route path="/credentials/new" element={<CredentialFormScreen />} />
        <Route path="/credentials/:credentialName" element={<p>Credential view</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function choosePlatform(platform: string) {
  await userEvent.click(screen.getByRole("combobox", { name: "Platform" }));
  await userEvent.click(await screen.findByRole("option", { name: platform }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CredentialFormScreen", () => {
  it("creates a github credential with null metadata", async () => {
    vi.mocked(credentialsApi.createCredential).mockResolvedValue({
      ...ROUTER,
      name: "ci-github",
      platform: "github",
    });
    mount();

    await userEvent.type(screen.getByLabelText("Name"), "ci-github");
    const key = screen.getByLabelText("API key");
    expect(key.getAttribute("type")).toBe("password");
    await userEvent.type(key, "ghp-secret");
    await userEvent.click(screen.getByRole("button", { name: "Create credential" }));

    expect(credentialsApi.createCredential).toHaveBeenCalledWith({
      name: "ci-github",
      platform: "github",
      metadata: null,
      secret: { key: "ghp-secret" },
    });
    expect(await screen.findByText("Credential view")).toBeTruthy();
  });

  it("creates an openai-compatible credential with a base URL and no models", async () => {
    vi.mocked(credentialsApi.createCredential).mockResolvedValue(ROUTER);
    mount();

    await userEvent.type(screen.getByLabelText("Name"), "router");
    await choosePlatform("openai-compatible");
    await userEvent.type(screen.getByLabelText("API key"), "sk-1");
    await userEvent.type(screen.getByLabelText("Base URL"), "https://openrouter.ai/api/v1");
    await userEvent.click(screen.getByRole("button", { name: "Create credential" }));

    expect(credentialsApi.createCredential).toHaveBeenCalledWith({
      name: "router",
      platform: "openai-compatible",
      metadata: { baseUrl: "https://openrouter.ai/api/v1", models: [] },
      secret: { key: "sk-1" },
    });
  });

  it("creates an openrouter credential with null metadata", async () => {
    vi.mocked(credentialsApi.createCredential).mockResolvedValue({
      ...ROUTER,
      platform: "openrouter",
    });
    mount();

    await userEvent.type(screen.getByLabelText("Name"), "router");
    await choosePlatform("openrouter");
    await userEvent.type(screen.getByLabelText("API key"), "sk-or");
    expect(screen.queryByLabelText("Base URL")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Create credential" }));

    expect(credentialsApi.createCredential).toHaveBeenCalledWith({
      name: "router",
      platform: "openrouter",
      metadata: null,
      secret: { key: "sk-or" },
    });
  });

  it("creates an s3 credential with the access key shape", async () => {
    vi.mocked(credentialsApi.createCredential).mockResolvedValue({
      ...ROUTER,
      name: "evidence",
      platform: "s3",
    });
    mount();

    await userEvent.type(screen.getByLabelText("Name"), "evidence");
    await choosePlatform("s3");
    await userEvent.type(screen.getByLabelText("Access key ID"), "AKIA1");
    await userEvent.type(screen.getByLabelText("Secret access key"), "s3-secret");
    await userEvent.type(screen.getByLabelText("Endpoint"), "https://s3.amazonaws.com");
    await userEvent.type(screen.getByLabelText("Bucket"), "evidence");
    await userEvent.type(screen.getByLabelText("Region"), "us-east-1");
    await userEvent.click(screen.getByRole("button", { name: "Create credential" }));

    expect(credentialsApi.createCredential).toHaveBeenCalledWith({
      name: "evidence",
      platform: "s3",
      metadata: { endpoint: "https://s3.amazonaws.com", bucket: "evidence", region: "us-east-1" },
      secret: { accessKeyId: "AKIA1", secretAccessKey: "s3-secret" },
    });
  });

  it("refuses an invalid draft before any request", async () => {
    mount();

    await userEvent.type(screen.getByLabelText("Name"), "login");
    await userEvent.click(screen.getByRole("button", { name: "Create credential" }));

    expect(screen.getByText("The name login is reserved. Choose another name.")).toBeTruthy();
    expect(screen.getByText("Enter a value.")).toBeTruthy();
    expect(credentialsApi.createCredential).not.toHaveBeenCalled();
  });

  it("explains a taken name and clears the secret", async () => {
    vi.mocked(credentialsApi.createCredential).mockRejectedValue(
      new ApiError("conflict", "Credential name already exists.", 409, "credential.name.conflict", {
        id: "credential_01J9ZQ4XKM3B6V8N2R5T7W0YAC",
      }),
    );
    mount();

    await userEvent.type(screen.getByLabelText("Name"), "ci-github");
    await userEvent.type(screen.getByLabelText("API key"), "ghp-secret");
    await userEvent.click(screen.getByRole("button", { name: "Create credential" }));

    expect(
      await screen.findByText(
        "A credential with this name already exists. Choose another name. The holder is credential_01J9ZQ4XKM3B6V8N2R5T7W0YAC.",
      ),
    ).toBeTruthy();
    expect((screen.getByLabelText("API key") as HTMLInputElement).value).toBe("");
  });
});
