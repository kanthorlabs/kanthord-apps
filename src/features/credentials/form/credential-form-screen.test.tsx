import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type * as Sonner from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as credentialsApi from "@/api/resources/credentials";
import type {
  Credential,
  CredentialComponent,
  CredentialLoginSession,
  CredentialPlatformEntry,
  CredentialPlatformList,
} from "@/api/types";

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

function entry(
  platform: string,
  secretShape: CredentialPlatformEntry["secretShape"],
  loginModes: CredentialPlatformEntry["loginModes"],
  metadataFields: readonly string[],
  verifiable = true,
): CredentialPlatformEntry {
  return { platform, secretShape, loginModes, metadataFields, verifiable };
}

const PLATFORMS: Readonly<Record<CredentialComponent, CredentialPlatformList>> = {
  repository: { items: [entry("github", "api_key", [], [])] },
  llm: {
    items: [
      entry("github-copilot", "oauth", ["device"], []),
      entry("openai-codex", "oauth", ["browser", "device"], []),
      entry("openai-compatible", "api_key", [], ["baseUrl"]),
      entry("openrouter", "api_key", [], []),
      entry("cloudflare-ai-gateway", "api_key", [], ["account_id", "gateway_id"]),
      entry("acme-sso", "oauth", ["device"], []),
      entry("mistral", "api_key", [], [], false),
    ],
  },
  storage: { items: [entry("s3", "s3_access_key", [], ["endpoint", "bucket", "region"])] },
};

const SECTIONS: Readonly<Record<CredentialComponent, string>> = {
  llm: "/llm",
  repository: "/repositories",
  storage: "/storage",
};

const SESSION: CredentialLoginSession = {
  sessionId: "login_session_01J9ZQ4XKM3B6V8N2R5T7W0YAC",
  address: "https://github.com/login/device",
  code: "ABCD-1234",
  expiresAt: Date.UTC(2026, 9, 4, 7, 15),
};

async function mount(component: CredentialComponent) {
  const section = SECTIONS[component];
  render(
    <MemoryRouter initialEntries={[`${section}/new`]}>
      <Routes>
        <Route path={`${section}/new`} element={<CredentialFormScreen component={component} />} />
        <Route path={`${section}/:credentialName`} element={<p>Credential view</p>} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByLabelText("Name");
}

async function choosePlatform(platform: string) {
  const input = screen.getByRole("combobox", { name: "Platform" });
  await userEvent.clear(input);
  await userEvent.type(input, platform);
  await userEvent.click(await screen.findByRole("option", { name: platform }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(credentialsApi.listCredentialPlatforms).mockImplementation(
    async (component) => PLATFORMS[component],
  );
});

describe("CredentialFormScreen", () => {
  it("creates a github credential with null metadata in the repository section", async () => {
    vi.mocked(credentialsApi.createCredential).mockResolvedValue({
      ...ROUTER,
      name: "ci-github",
      platform: "github",
    });
    await mount("repository");

    await userEvent.type(screen.getByLabelText("Name"), "ci-github");
    const key = screen.getByLabelText("API key");
    expect(key.getAttribute("type")).toBe("password");
    await userEvent.type(key, "ghp-secret");
    await userEvent.click(screen.getByRole("button", { name: "Create credential" }));

    expect(credentialsApi.listCredentialPlatforms).toHaveBeenCalledWith("repository");
    expect(credentialsApi.createCredential).toHaveBeenCalledWith("repository", {
      name: "ci-github",
      platform: "github",
      metadata: null,
      secret: { key: "ghp-secret" },
    });
    expect(await screen.findByText("Credential view")).toBeTruthy();
  });

  it("creates an openai-compatible credential with a base URL and no models", async () => {
    vi.mocked(credentialsApi.createCredential).mockResolvedValue(ROUTER);
    await mount("llm");

    await userEvent.type(screen.getByLabelText("Name"), "router");
    await choosePlatform("openai-compatible");
    await userEvent.type(screen.getByLabelText("API key"), "sk-1");
    await userEvent.type(screen.getByLabelText("baseUrl"), "https://openrouter.ai/api/v1");
    await userEvent.click(screen.getByRole("button", { name: "Create credential" }));

    expect(credentialsApi.createCredential).toHaveBeenCalledWith("llm", {
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
    await mount("llm");

    await userEvent.type(screen.getByLabelText("Name"), "router");
    await choosePlatform("openrouter");
    await userEvent.type(screen.getByLabelText("API key"), "sk-or");
    expect(screen.queryByLabelText("baseUrl")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Create credential" }));

    expect(credentialsApi.createCredential).toHaveBeenCalledWith("llm", {
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
    await mount("storage");

    await userEvent.type(screen.getByLabelText("Name"), "evidence");
    await choosePlatform("s3");
    await userEvent.type(screen.getByLabelText("Access key ID"), "AKIA1");
    await userEvent.type(screen.getByLabelText("Secret access key"), "s3-secret");
    await userEvent.type(screen.getByLabelText("endpoint"), "https://s3.amazonaws.com");
    await userEvent.type(screen.getByLabelText("bucket"), "evidence");
    await userEvent.type(screen.getByLabelText("region"), "us-east-1");
    await userEvent.click(screen.getByRole("button", { name: "Create credential" }));

    expect(credentialsApi.createCredential).toHaveBeenCalledWith("storage", {
      name: "evidence",
      platform: "s3",
      metadata: { endpoint: "https://s3.amazonaws.com", bucket: "evidence", region: "us-east-1" },
      secret: { accessKeyId: "AKIA1", secretAccessKey: "s3-secret" },
    });
  });

  it("offers the platforms of the section in a flat list filtered by the typed id", async () => {
    await mount("llm");

    const input = screen.getByRole("combobox", { name: "Platform" });
    expect((input as HTMLInputElement).value).toBe("github-copilot");
    await userEvent.clear(input);
    await userEvent.type(input, "open");
    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "openai-codex",
      "openai-compatible",
      "openrouter",
    ]);
    expect(screen.queryByRole("option", { name: "github" })).toBeNull();
    expect(screen.queryByRole("option", { name: "s3" })).toBeNull();
  });

  it("offers only the repository platforms and no sign-in in the repository section", async () => {
    await mount("repository");

    expect(screen.getByRole("button", { name: "Create credential" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start sign-in" })).toBeNull();
    const input = screen.getByRole("combobox", { name: "Platform" });
    await userEvent.clear(input);
    await userEvent.type(input, "i");
    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["github"]);
    expect(credentialsApi.startCredentialLogin).not.toHaveBeenCalled();
  });

  it("renders one text input for each metadata field and sends it under its name", async () => {
    vi.mocked(credentialsApi.createCredential).mockResolvedValue({
      ...ROUTER,
      name: "gateway",
      platform: "cloudflare-ai-gateway",
    });
    await mount("llm");

    await userEvent.type(screen.getByLabelText("Name"), "gateway");
    await choosePlatform("cloudflare-ai-gateway");
    await userEvent.type(screen.getByLabelText("API key"), "cf-1");
    await userEvent.type(screen.getByLabelText("account_id"), "acc-1");
    await userEvent.type(screen.getByLabelText("gateway_id"), "gw-1");
    await userEvent.click(screen.getByRole("button", { name: "Create credential" }));

    expect(credentialsApi.createCredential).toHaveBeenCalledWith("llm", {
      name: "gateway",
      platform: "cloudflare-ai-gateway",
      metadata: { account_id: "acc-1", gateway_id: "gw-1" },
      secret: { key: "cf-1" },
    });
  });

  it("chooses the sign-in from the secret shape of the platform entry", async () => {
    vi.mocked(credentialsApi.startCredentialLogin).mockResolvedValue(SESSION);
    vi.mocked(credentialsApi.readCredentialLoginStatus).mockResolvedValue({
      sessionId: SESSION.sessionId,
      state: "pending",
      lastMessage: null,
      failureReason: null,
    });
    await mount("llm");

    await userEvent.type(screen.getByLabelText("Name"), "acme");
    await choosePlatform("acme-sso");
    expect(screen.queryByLabelText("API key")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Start sign-in" }));

    expect(await screen.findByText("ABCD-1234")).toBeTruthy();
    expect(credentialsApi.startCredentialLogin).toHaveBeenCalledWith({
      platform: "acme-sso",
      name: "acme",
    });
  });

  it("keeps Verify and Create disabled until every required field is filled", async () => {
    await mount("repository");

    const create = screen.getByRole("button", { name: "Create credential" });
    const check = screen.getByRole("button", { name: "Check the typed secret" });
    expect(create.hasAttribute("disabled")).toBe(true);
    expect(check.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Fill Name and API key to verify and create.")).toBeTruthy();

    await userEvent.type(screen.getByLabelText("API key"), "ghp-secret");
    expect(check.hasAttribute("disabled")).toBe(false);
    expect(create.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Fill Name to verify and create.")).toBeTruthy();
  });

  it("refuses an invalid draft before any request", async () => {
    await mount("repository");

    await userEvent.type(screen.getByLabelText("Name"), "login");
    await userEvent.type(screen.getByLabelText("API key"), "ghp-secret");
    await userEvent.click(screen.getByRole("button", { name: "Create credential" }));

    expect(screen.getByText("The name login is reserved. Choose another name.")).toBeTruthy();
    expect(credentialsApi.createCredential).not.toHaveBeenCalled();
  });

  it("checks the typed secret without a name and shows a healthy badge", async () => {
    vi.mocked(credentialsApi.checkCredential).mockResolvedValue({
      status: "healthy",
      capability: "rate-limit read",
    });
    await mount("repository");

    await userEvent.type(screen.getByLabelText("API key"), "ghp-secret");
    await userEvent.click(screen.getByRole("button", { name: "Check the typed secret" }));

    expect(await screen.findByText("Healthy")).toBeTruthy();
    expect(credentialsApi.checkCredential).toHaveBeenCalledWith("repository", {
      platform: "github",
      metadata: null,
      secret: { key: "ghp-secret" },
    });
    expect(credentialsApi.createCredential).not.toHaveBeenCalled();
  });

  it("shows an unhealthy and an unknown badge", async () => {
    vi.mocked(credentialsApi.checkCredential)
      .mockResolvedValueOnce({ status: "unhealthy", capability: "rate-limit read" })
      .mockResolvedValueOnce({ status: "unknown", capability: "rate-limit read" });
    await mount("repository");

    await userEvent.type(screen.getByLabelText("API key"), "ghp-secret");
    await userEvent.click(screen.getByRole("button", { name: "Check the typed secret" }));
    expect(await screen.findByText("Unhealthy")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Check the typed secret" }));
    expect(await screen.findByText("Unknown")).toBeTruthy();
    expect(screen.queryByText("Unhealthy")).toBeNull();
  });

  it("sends the typed metadata of the platform with the check", async () => {
    vi.mocked(credentialsApi.checkCredential).mockResolvedValue({
      status: "healthy",
      capability: "model-list read",
    });
    await mount("llm");

    await choosePlatform("openai-compatible");
    await userEvent.type(screen.getByLabelText("API key"), "sk-1");
    await userEvent.type(screen.getByLabelText("baseUrl"), "https://openrouter.ai/api/v1");
    await userEvent.click(screen.getByRole("button", { name: "Check the typed secret" }));

    expect(await screen.findByText("Healthy")).toBeTruthy();
    expect(credentialsApi.checkCredential).toHaveBeenCalledWith("llm", {
      platform: "openai-compatible",
      metadata: { baseUrl: "https://openrouter.ai/api/v1", models: [] },
      secret: { key: "sk-1" },
    });
  });

  it("resets the badge when the secret or the platform changes", async () => {
    vi.mocked(credentialsApi.checkCredential).mockResolvedValue({
      status: "healthy",
      capability: "rate-limit read",
    });
    await mount("llm");

    await choosePlatform("openrouter");
    await userEvent.type(screen.getByLabelText("API key"), "sk-1");
    await userEvent.click(screen.getByRole("button", { name: "Check the typed secret" }));
    expect(await screen.findByText("Healthy")).toBeTruthy();
    await userEvent.type(screen.getByLabelText("API key"), "2");
    expect(screen.queryByText("Healthy")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Check the typed secret" }));
    expect(await screen.findByText("Healthy")).toBeTruthy();
    await choosePlatform("openai-compatible");
    expect(screen.queryByText("Healthy")).toBeNull();
  });

  it("shows the message of a refused check and asks no check for an empty secret", async () => {
    vi.mocked(credentialsApi.checkCredential).mockRejectedValue(
      new ApiError("malformed", "Invalid.", 400, "credential.input.invalid"),
    );
    await mount("repository");

    expect(
      screen.getByRole("button", { name: "Check the typed secret" }).hasAttribute("disabled"),
    ).toBe(true);
    expect(credentialsApi.checkCredential).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText("API key"), "ghp-secret");
    await userEvent.click(screen.getByRole("button", { name: "Check the typed secret" }));
    expect(await screen.findByText("Check failed")).toBeTruthy();
    expect(
      screen.getByText(
        "Custody refused the secret or the metadata. Check each field against the rules of the platform.",
      ),
    ).toBeTruthy();
  });

  it("disables the check for a platform that is not verifiable and hides it for a sign-in", async () => {
    await mount("llm");

    expect(screen.queryByRole("button", { name: "Check the typed secret" })).toBeNull();
    await choosePlatform("mistral");
    expect(screen.getByLabelText("API key")).toBeTruthy();
    const disabled = screen.getByRole("button", { name: "Check the typed secret" });
    expect(
      disabled.getAttribute("aria-disabled") ?? disabled.hasAttribute("disabled"),
    ).toBeTruthy();
    await userEvent.click(disabled);
    expect(await screen.findByText("Verification is not supported yet for mistral.")).toBeTruthy();
    expect(credentialsApi.checkCredential).not.toHaveBeenCalled();
    await choosePlatform("openrouter");
    await userEvent.type(screen.getByLabelText("API key"), "or-secret");
    expect(
      screen.getByRole("button", { name: "Check the typed secret" }).hasAttribute("disabled"),
    ).toBe(false);
  });

  it("refuses the reserved name check before any request", async () => {
    await mount("repository");

    await userEvent.type(screen.getByLabelText("Name"), "check");
    await userEvent.type(screen.getByLabelText("API key"), "ghp-secret");
    await userEvent.click(screen.getByRole("button", { name: "Create credential" }));

    expect(screen.getByText("The name check is reserved. Choose another name.")).toBeTruthy();
    expect(credentialsApi.createCredential).not.toHaveBeenCalled();
  });

  it("explains a taken name and clears the secret", async () => {
    vi.mocked(credentialsApi.createCredential).mockRejectedValue(
      new ApiError("conflict", "Credential name already exists.", 409, "credential.name.conflict", {
        id: "credential_01J9ZQ4XKM3B6V8N2R5T7W0YAC",
      }),
    );
    await mount("repository");

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

  it("runs a sign-in for an oauth platform instead of asking for a secret", async () => {
    vi.mocked(credentialsApi.startCredentialLogin).mockResolvedValue(SESSION);
    vi.mocked(credentialsApi.readCredentialLoginStatus).mockResolvedValue({
      sessionId: SESSION.sessionId,
      state: "pending",
      lastMessage: null,
      failureReason: null,
    });
    await mount("llm");

    await userEvent.type(screen.getByLabelText("Name"), "copilot");
    await choosePlatform("github-copilot");
    expect(screen.queryByLabelText("API key")).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Sign-in mode" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Start sign-in" }));

    expect(await screen.findByText("ABCD-1234")).toBeTruthy();
    expect(screen.getByRole("link", { name: SESSION.address })).toBeTruthy();
    expect(screen.getByText("2026-10-04 07:15 UTC")).toBeTruthy();
    expect(credentialsApi.startCredentialLogin).toHaveBeenCalledWith({
      platform: "github-copilot",
      name: "copilot",
    });
    expect(screen.queryByRole("button", { name: "Open sign-in page" })).toBeNull();
    expect(credentialsApi.createCredential).not.toHaveBeenCalled();
  });

  it("opens the credential when the sign-in completes", async () => {
    vi.mocked(credentialsApi.startCredentialLogin).mockResolvedValue(SESSION);
    vi.mocked(credentialsApi.readCredentialLoginStatus).mockResolvedValue({
      sessionId: SESSION.sessionId,
      state: "completed",
      lastMessage: null,
      failureReason: null,
    });
    await mount("llm");

    await userEvent.type(screen.getByLabelText("Name"), "copilot");
    await choosePlatform("github-copilot");
    await userEvent.click(screen.getByRole("button", { name: "Start sign-in" }));

    expect(await screen.findByText("Credential view", undefined, { timeout: 4000 })).toBeTruthy();
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
    await mount("llm");

    await userEvent.type(screen.getByLabelText("Name"), "copilot");
    await choosePlatform("github-copilot");
    await userEvent.click(screen.getByRole("button", { name: "Start sign-in" }));
    const field = await screen.findByLabelText("Code or redirect URL");
    await userEvent.type(field, "http://localhost:1455/callback?code=1");
    await userEvent.click(screen.getByRole("button", { name: "Send code" }));

    expect(credentialsApi.submitCredentialLoginCode).toHaveBeenCalledWith(
      SESSION.sessionId,
      "http://localhost:1455/callback?code=1",
    );
    expect((field as HTMLInputElement).value).toBe("");
  });

  it("runs a sign-in for openai-codex", async () => {
    vi.mocked(credentialsApi.startCredentialLogin).mockResolvedValue(SESSION);
    vi.mocked(credentialsApi.readCredentialLoginStatus).mockResolvedValue({
      sessionId: SESSION.sessionId,
      state: "pending",
      lastMessage: null,
      failureReason: null,
    });
    await mount("llm");

    await userEvent.type(screen.getByLabelText("Name"), "codex");
    await choosePlatform("openai-codex");
    expect(screen.queryByLabelText("API key")).toBeNull();
    expect(screen.getByRole("combobox", { name: "Sign-in mode" }).textContent).toContain("Browser");
    await userEvent.click(screen.getByRole("button", { name: "Start sign-in" }));

    expect(await screen.findByText("ABCD-1234")).toBeTruthy();
    expect(credentialsApi.startCredentialLogin).toHaveBeenCalledWith({
      platform: "openai-codex",
      name: "codex",
      mode: "browser",
    });
    const open = screen.getByRole("button", { name: "Open sign-in page" });
    expect(open.getAttribute("href")).toBe(SESSION.address);
    expect(open.getAttribute("target")).toBe("_blank");
    expect(open.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("starts a headless openai-codex sign-in without the open button", async () => {
    vi.mocked(credentialsApi.startCredentialLogin).mockResolvedValue(SESSION);
    vi.mocked(credentialsApi.readCredentialLoginStatus).mockResolvedValue({
      sessionId: SESSION.sessionId,
      state: "pending",
      lastMessage: null,
      failureReason: null,
    });
    await mount("llm");

    await userEvent.type(screen.getByLabelText("Name"), "codex");
    await choosePlatform("openai-codex");
    await userEvent.click(screen.getByRole("combobox", { name: "Sign-in mode" }));
    await userEvent.click(await screen.findByRole("option", { name: "Headless (device code)" }));
    await userEvent.click(screen.getByRole("button", { name: "Start sign-in" }));

    expect(await screen.findByText("ABCD-1234")).toBeTruthy();
    expect(credentialsApi.startCredentialLogin).toHaveBeenCalledWith({
      platform: "openai-codex",
      name: "codex",
      mode: "device",
    });
    expect(screen.queryByRole("button", { name: "Open sign-in page" })).toBeNull();
  });

  it("explains a pending sign-in", async () => {
    vi.mocked(credentialsApi.startCredentialLogin).mockRejectedValue(
      new ApiError("conflict", "Pending.", 409, "credential.login.pending"),
    );
    await mount("llm");

    await userEvent.type(screen.getByLabelText("Name"), "copilot");
    await choosePlatform("github-copilot");
    await userEvent.click(screen.getByRole("button", { name: "Start sign-in" }));

    expect(await screen.findByText("The sign-in did not start.")).toBeTruthy();
    expect(screen.getByText(/Another sign-in of yours for this platform is pending/)).toBeTruthy();
  });
});
