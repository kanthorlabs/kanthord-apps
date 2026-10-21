import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type * as Sonner from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as credentialsApi from "@/api/resources/credentials";
import type {
  Credential,
  CredentialComponent,
  CredentialPlatformEntry,
  CredentialPlatformList,
  HealthEntry,
} from "@/api/types";

vi.mock("@/api/resources/credentials");
vi.mock("sonner", async (importOriginal) => ({
  ...(await importOriginal<typeof Sonner>()),
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import { toast } from "sonner";

import { CredentialsScreen } from "./credentials-screen";
import { utcDateTime } from "@/lib/format";
import { textContent } from "../../../../test/text-content";

const OPENROUTER: Credential = {
  name: "ci-openrouter",
  platform: "openrouter",
  holder: "server",
  sealed_to: null,
  sealed_current: true,
  revisions: [
    {
      id: "credential_01J9ZQ4XKM3B6V8N2R5T7W0YAD",
      revision: 2,
      metadata: null,
      created_at: Date.UTC(2026, 9, 3, 14, 5),
      ended_at: null,
    },
    {
      id: "credential_01J9ZQ4XKM3B6V8N2R5T7W0YAC",
      revision: 1,
      metadata: null,
      created_at: Date.UTC(2026, 9, 2, 9, 0),
      ended_at: Date.UTC(2026, 9, 3, 14, 5),
    },
  ],
};
const ROUTER: Credential = {
  name: "router",
  platform: "openai-compatible",
  holder: "server",
  sealed_to: null,
  sealed_current: true,
  revisions: [
    {
      id: "credential_01J9ZQ4XKM3B6V8N2R5T7W0YAE",
      revision: 1,
      metadata: { base_url: "https://openrouter.ai/api/v1", models: [] },
      created_at: Date.UTC(2026, 9, 1, 8, 0),
      ended_at: null,
    },
  ],
};
const BEDROCK: Credential = {
  name: "bedrock",
  platform: "amazon-bedrock",
  holder: "server",
  sealed_to: null,
  sealed_current: true,
  revisions: [
    {
      id: "credential_01J9ZQ4XKM3B6V8N2R5T7W0YAF",
      revision: 1,
      metadata: { region: "us-east-1" },
      created_at: Date.UTC(2026, 9, 1, 8, 0),
      ended_at: null,
    },
  ],
};

function apiKey(
  platform: string,
  metadataFields: readonly string[],
  verifiable: boolean,
): CredentialPlatformEntry {
  return {
    platform,
    secret_shape: "api_key",
    login_modes: [],
    metadata_fields: metadataFields,
    verifiable,
  };
}

const PLATFORMS: CredentialPlatformList = {
  items: [
    apiKey("openai-compatible", ["base_url"], true),
    apiKey("openrouter", [], true),
    apiKey("amazon-bedrock", ["region"], false),
  ],
};

const SSH_KEY_CREDENTIAL: Credential = {
  name: "atlas-ssh",
  platform: "ssh",
  holder: "server",
  sealed_to: null,
  sealed_current: true,
  revisions: [
    {
      id: "credential_01J9ZQ4XKM3B6V8N2R5T7W0YAS",
      revision: 1,
      metadata: {
        public_key: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIA kanthord-atlas-ssh",
        fingerprint: "SHA256:uNiVztksCsDhcc0u9e8BujQXVUpKZIDTMczCvj3tD2s",
      },
      created_at: Date.UTC(2026, 9, 1, 8, 0),
      ended_at: null,
    },
  ],
};

const REPOSITORY_PLATFORMS: CredentialPlatformList = {
  items: [
    apiKey("github", [], true),
    {
      platform: "ssh",
      secret_shape: "ssh_key",
      login_modes: [],
      metadata_fields: [],
      verifiable: true,
    },
  ],
};

const UNHEALTHY: HealthEntry = {
  status: "unhealthy",
  capability: "rate-limit read",
  failure_reason: "unclassified",
};
const HEALTHY: HealthEntry = {
  status: "healthy",
  capability: "rate-limit read",
  failure_reason: null,
};

function mount(component: CredentialComponent = "llm", section = "/llm") {
  return render(
    <MemoryRouter initialEntries={[section]}>
      <Routes>
        <Route path={section} element={<CredentialsScreen component={component} />} />
        <Route path={`${section}/new`} element={<p>New credential form</p>} />
        <Route path={`${section}/:credentialName`} element={<p>Credential view</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function filterBy(text: string, option: string) {
  const input = await screen.findByRole("combobox", { name: "Platform" });
  await userEvent.clear(input);
  await userEvent.type(input, text);
  await userEvent.click(await screen.findByRole("option", { name: option }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(credentialsApi.listCredentialPlatforms).mockResolvedValue(PLATFORMS);
  vi.mocked(credentialsApi.listHostKeys).mockResolvedValue([]);
});

describe("CredentialsScreen", () => {
  it.each([
    [
      "llm",
      "/llm",
      "An LLM credential holds the secret of a model platform. An agent provider uses it to call the models of that platform. Instance credentials live on the worker pages.",
    ],
    [
      "repository",
      "/repositories",
      "A Git credential holds the secret that reaches the repositories of a project, a GitHub token or an SSH key. A repository binding of a project uses it.",
    ],
    [
      "storage",
      "/storage",
      "A storage credential holds the access key of an S3 bucket. A storage binding of a project uses it.",
    ],
  ] as const)("describes the %s credentials in one line", async (component, section, line) => {
    vi.mocked(credentialsApi.listCredentialPage).mockResolvedValue({
      items: [],
      next_cursor: null,
    });
    mount(component, section);

    expect(await screen.findByText(line)).toBeTruthy();
  });

  it("lists each credential with its platform and newest live revision", async () => {
    vi.mocked(credentialsApi.listCredentialPage).mockResolvedValue({
      items: [OPENROUTER, ROUTER],
      next_cursor: null,
    });
    mount();

    const list = await screen.findByRole("list", { name: "Credentials" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByText("openrouter")).toBeTruthy();
    expect(within(items[0]!).getByText("(v2)")).toBeTruthy();
    expect(within(items[0]!).getByText("2026-10-03 14:05 UTC")).toBeTruthy();
    expect(credentialsApi.listCredentialPage).toHaveBeenCalledWith(
      "llm",
      null,
      null,
      false,
      "server",
    );
  });

  it("opens a credential from its row", async () => {
    vi.mocked(credentialsApi.listCredentialPage).mockResolvedValue({
      items: [OPENROUTER],
      next_cursor: null,
    });
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Open ci-openrouter" }));

    expect(screen.getByText("Credential view")).toBeTruthy();
  });

  it("filters the list by platform", async () => {
    vi.mocked(credentialsApi.listCredentialPage).mockResolvedValue({
      items: [OPENROUTER],
      next_cursor: null,
    });
    mount();

    await screen.findByRole("button", { name: "Verify ci-openrouter" });
    await filterBy("openai-compatible", "openai-compatible");

    expect(credentialsApi.listCredentialPage).toHaveBeenLastCalledWith(
      "llm",
      "openai-compatible",
      null,
      false,
      "server",
    );

    await filterBy("openrouter", "openrouter");

    expect(credentialsApi.listCredentialPage).toHaveBeenLastCalledWith(
      "llm",
      "openrouter",
      null,
      false,
      "server",
    );

    await filterBy("All", "All platforms");

    expect(credentialsApi.listCredentialPage).toHaveBeenLastCalledWith(
      "llm",
      null,
      null,
      false,
      "server",
    );
  });

  it("offers All platforms first and the platforms of the section in a flat list", async () => {
    vi.mocked(credentialsApi.listCredentialPage).mockResolvedValue({
      items: [OPENROUTER],
      next_cursor: null,
    });
    mount();

    await screen.findByRole("button", { name: "Verify ci-openrouter" });
    const input = screen.getByRole("combobox", { name: "Platform" });
    expect((input as HTMLInputElement).value).toBe("All platforms");
    await userEvent.clear(input);
    await userEvent.type(input, "a");

    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "All platforms",
      "openai-compatible",
      "amazon-bedrock",
    ]);
    await waitFor(() => expect(credentialsApi.listCredentialPlatforms).toHaveBeenCalledWith("llm"));

    await userEvent.type(input, "mazon");
    expect(screen.getByRole("option", { name: "amazon-bedrock" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "openrouter" })).toBeNull();
  });

  it("disables Verify for a platform that is not verifiable and says why on a tap", async () => {
    vi.mocked(credentialsApi.listCredentialPage).mockResolvedValue({
      items: [BEDROCK, OPENROUTER],
      next_cursor: null,
    });
    mount();

    expect(await screen.findByRole("button", { name: "Verify ci-openrouter" })).toBeEnabled();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Verify bedrock" })).toHaveAttribute(
        "aria-disabled",
        "true",
      ),
    );

    await userEvent.pointer({
      keys: "[TouchA]",
      target: screen.getByRole("button", { name: "Verify bedrock" }),
    });

    expect(
      await screen.findByText(
        textContent("Verification is not supported yet for amazon-bedrock."),
        undefined,
        {
          timeout: 300,
        },
      ),
    ).toBeTruthy();
    expect(credentialsApi.verifyCredential).not.toHaveBeenCalled();
  });

  it("opens the Verify tooltip on hover", async () => {
    vi.mocked(credentialsApi.listCredentialPage).mockResolvedValue({
      items: [BEDROCK],
      next_cursor: null,
    });
    mount();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Verify bedrock" })).toHaveAttribute(
        "aria-disabled",
        "true",
      ),
    );
    await userEvent.hover(screen.getByRole("button", { name: "Verify bedrock" }));

    expect(
      await screen.findByText(
        textContent("Verification is not supported yet for amazon-bedrock."),
        undefined,
        {
          timeout: 2000,
        },
      ),
    ).toBeTruthy();
  });

  it("includes archived credentials on request and offers only Revisions on them", async () => {
    const ARCHIVED: Credential = {
      ...ROUTER,
      name: "legacy",
      revisions: ROUTER.revisions.map((entry) => ({ ...entry, ended_at: Date.UTC(2026, 9, 2) })),
    };
    vi.mocked(credentialsApi.listCredentialPage).mockImplementation(
      async (_component, _platform, _cursor, includeArchived) => ({
        items: includeArchived === true ? [OPENROUTER, ARCHIVED] : [OPENROUTER],
        next_cursor: null,
      }),
    );
    mount();

    await screen.findByRole("button", { name: "Verify ci-openrouter" });
    expect(screen.queryByText("Archived")).toBeNull();

    await userEvent.click(screen.getByRole("switch", { name: "Include archived" }));

    expect(credentialsApi.listCredentialPage).toHaveBeenLastCalledWith(
      "llm",
      null,
      null,
      true,
      "server",
    );
    expect((await screen.findAllByText("Archived")).length).toBe(2);
    expect(screen.getAllByText(utcDateTime(Date.UTC(2026, 9, 2))).length).toBeGreaterThan(0);
    expect(screen.queryByText("Updated")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Revisions of legacy" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Verify legacy" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Rotate legacy" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit metadata of legacy" })).toBeNull();
  });

  it("shows the check state as a badge on the row and keeps the other rows idle", async () => {
    vi.mocked(credentialsApi.listCredentialPage).mockResolvedValue({
      items: [OPENROUTER, ROUTER],
      next_cursor: null,
    });
    let answer: (entry: HealthEntry) => void = () => {};
    vi.mocked(credentialsApi.verifyCredential).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Verify ci-openrouter" }));

    const items = within(screen.getByRole("list", { name: "Credentials" })).getAllByRole(
      "listitem",
    );
    expect(within(items[0]!).getByRole("status").textContent).toBe("Checking");
    const verify = screen.getByRole("button", { name: "Verify ci-openrouter" });
    expect(verify).toBeDisabled();
    expect(verify).toHaveAttribute("aria-busy", "true");

    answer(UNHEALTHY);

    await waitFor(() =>
      expect(within(items[0]!).getByRole("status").textContent).toBe("Unhealthy"),
    );
    expect(screen.getByRole("button", { name: "Verify ci-openrouter" })).toBeEnabled();
    expect(within(items[0]!).queryByText(/Capability/)).toBeNull();
    expect(within(items[0]!).queryByText(/Health checked at/)).toBeNull();
    expect(within(items[0]!).queryByText(/Checking\. The health report/)).toBeNull();
    expect(within(items[1]!).getByRole("status").textContent).toBe("");
    expect(credentialsApi.verifyCredential).toHaveBeenCalledTimes(1);
    expect(credentialsApi.verifyCredential).toHaveBeenCalledWith("llm", "ci-openrouter");
  });

  it("reports a failed verify with a badge and a toast that retries", async () => {
    vi.mocked(credentialsApi.listCredentialPage).mockResolvedValue({
      items: [OPENROUTER],
      next_cursor: null,
    });
    vi.mocked(credentialsApi.verifyCredential).mockRejectedValueOnce(
      new ApiError("conflict", "Archived.", 409, "credential.credential.archived"),
    );
    vi.mocked(credentialsApi.verifyCredential).mockResolvedValueOnce(UNHEALTHY);
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Verify ci-openrouter" }));

    const item = within(screen.getByRole("list", { name: "Credentials" })).getByRole("listitem");
    await waitFor(() => expect(within(item).getByRole("status").textContent).toBe("Check failed"));
    expect(within(item).queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "Verify ci-openrouter" })).toBeEnabled();
    expect(toast.error).toHaveBeenCalledWith("Verifying ci-openrouter failed.", {
      description: "This credential is archived. An archive is final, and the name stays taken.",
      action: { label: "Retry", onClick: expect.any(Function) },
    });

    const retry = vi.mocked(toast.error).mock.calls[0]![1]!.action as Sonner.Action;
    act(() => retry.onClick({} as Parameters<Sonner.Action["onClick"]>[0]));

    await waitFor(() => expect(within(item).getByRole("status").textContent).toBe("Unhealthy"));
    expect(credentialsApi.verifyCredential).toHaveBeenCalledTimes(2);
  });

  it("rotates a credential from its row", async () => {
    vi.mocked(credentialsApi.listCredentialPage).mockResolvedValue({
      items: [OPENROUTER],
      next_cursor: null,
    });
    vi.mocked(credentialsApi.rotateCredential).mockResolvedValue(OPENROUTER);
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Rotate ci-openrouter" }));
    const sheet = await screen.findByRole("dialog");
    await userEvent.type(within(sheet).getByLabelText("API Key"), "ghp-2");
    await userEvent.click(within(sheet).getByRole("button", { name: "Rotate secret" }));

    expect(credentialsApi.rotateCredential).toHaveBeenCalledWith("llm", "ci-openrouter", {
      expected_revision: 2,
      secret: { key: "ghp-2" },
    });
  });

  it("offers a metadata edit only for a platform with metadata", async () => {
    vi.mocked(credentialsApi.listCredentialPage).mockResolvedValue({
      items: [OPENROUTER, ROUTER],
      next_cursor: null,
    });
    mount();

    expect(await screen.findByRole("button", { name: "Edit metadata of router" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Edit metadata of ci-openrouter" })).toBeNull();
  });

  it("opens the detail from the row and offers no revisions action", async () => {
    vi.mocked(credentialsApi.listCredentialPage).mockResolvedValue({
      items: [ROUTER],
      next_cursor: null,
    });
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Open router" }));

    expect(screen.queryByRole("button", { name: "Revisions of router" })).toBeNull();
    expect(screen.getByText("Credential view")).toBeTruthy();
  });

  it("offers the new credential form and the sign-in", async () => {
    vi.mocked(credentialsApi.listCredentialPage).mockResolvedValue({
      items: [],
      next_cursor: null,
    });
    mount();

    expect(
      await screen.findByText("No credentials. Create the first one with New credential."),
    ).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "New credential" }));

    expect(screen.getByText("New credential form")).toBeTruthy();
  });

  it("reads the repository section and links its rows and form under the section", async () => {
    const GITHUB: Credential = { ...OPENROUTER, name: "ci-github", platform: "github" };
    vi.mocked(credentialsApi.listCredentialPage).mockResolvedValue({
      items: [GITHUB],
      next_cursor: null,
    });
    mount("repository", "/repositories");

    await userEvent.click(await screen.findByRole("button", { name: "Open ci-github" }));

    expect(credentialsApi.listCredentialPage).toHaveBeenCalledWith(
      "repository",
      null,
      null,
      false,
      null,
    );
    await waitFor(() =>
      expect(credentialsApi.listCredentialPlatforms).toHaveBeenCalledWith("repository"),
    );
    expect(screen.getByText("Credential view")).toBeTruthy();
  });

  it("verifies a repository credential through the repository section", async () => {
    const GITHUB: Credential = { ...OPENROUTER, name: "ci-github", platform: "github" };
    vi.mocked(credentialsApi.listCredentialPage).mockResolvedValue({
      items: [GITHUB],
      next_cursor: null,
    });
    vi.mocked(credentialsApi.verifyCredential).mockResolvedValue(HEALTHY);
    mount("repository", "/repositories");

    await userEvent.click(await screen.findByRole("button", { name: "Verify ci-github" }));
    expect(credentialsApi.verifyCredential).toHaveBeenCalledWith("repository", "ci-github");

    const item = within(screen.getByRole("list", { name: "Credentials" })).getByRole("listitem");
    await waitFor(() => expect(within(item).getByRole("status").textContent).toBe("Healthy"));
  });

  it("creates an SSH key from the repository section in place of an import", async () => {
    vi.mocked(credentialsApi.listCredentialPage).mockResolvedValue({
      items: [],
      next_cursor: null,
    });
    vi.mocked(credentialsApi.createSshKey).mockResolvedValue({
      ...SSH_KEY_CREDENTIAL,
      name: "deploy-atlas",
    });
    mount("repository", "/repositories");

    expect(screen.queryByRole("button", { name: /Import from/ })).toBeNull();
    await userEvent.click(await screen.findByRole("button", { name: "Create SSH key" }));
    const sheet = await screen.findByRole("dialog", { name: "Create SSH key" });
    await userEvent.type(within(sheet).getByLabelText("Name"), "deploy-atlas");
    await userEvent.click(within(sheet).getByRole("button", { name: "Create SSH key" }));
    await userEvent.click(await screen.findByRole("button", { name: "Done" }));

    expect(credentialsApi.createSshKey).toHaveBeenCalledWith({ name: "deploy-atlas" });
    await waitFor(() => expect(credentialsApi.listCredentialPage).toHaveBeenCalledTimes(2));
  });

  it("opens the SSH key sheet on arrival and returns to the router state path after Done", async () => {
    vi.mocked(credentialsApi.listCredentialPage).mockResolvedValue({
      items: [],
      next_cursor: null,
    });
    vi.mocked(credentialsApi.createSshKey).mockResolvedValue({
      ...SSH_KEY_CREDENTIAL,
      name: "deploy-atlas",
    });
    render(
      <MemoryRouter
        initialEntries={[
          { pathname: "/repositories", hash: "#create-ssh-key", state: { return_to: "/" } },
        ]}
      >
        <Routes>
          <Route path="/repositories" element={<CredentialsScreen component="repository" />} />
          <Route path="/" element={<p>Onboarding</p>} />
        </Routes>
      </MemoryRouter>,
    );

    const sheet = await screen.findByRole("dialog", { name: "Create SSH key" });
    await userEvent.type(within(sheet).getByLabelText("Name"), "deploy-atlas");
    await userEvent.click(within(sheet).getByRole("button", { name: "Create SSH key" }));
    await userEvent.click(await screen.findByRole("button", { name: "Done" }));

    expect(await screen.findByText("Onboarding")).toBeTruthy();
  });

  it("opens no SSH key sheet on the LLM credentials with the create SSH key hash", async () => {
    vi.mocked(credentialsApi.listCredentialPage).mockResolvedValue({
      items: [],
      next_cursor: null,
    });
    render(
      <MemoryRouter initialEntries={[{ pathname: "/llm", hash: "#create-ssh-key" }]}>
        <Routes>
          <Route path="/llm" element={<CredentialsScreen component="llm" />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText("No credentials. Create the first one with New credential.");
    expect(screen.queryByRole("dialog", { name: "Create SSH key" })).toBeNull();
  });

  it("offers Rotate key and no secret rotate or metadata edit on an ssh row", async () => {
    vi.mocked(credentialsApi.listCredentialPlatforms).mockResolvedValue(REPOSITORY_PLATFORMS);
    vi.mocked(credentialsApi.listCredentialPage).mockResolvedValue({
      items: [SSH_KEY_CREDENTIAL],
      next_cursor: null,
    });
    vi.mocked(credentialsApi.readCredential).mockResolvedValue({
      ...SSH_KEY_CREDENTIAL,
      bindings: [],
    });
    mount("repository", "/repositories");

    await userEvent.click(await screen.findByRole("button", { name: "Rotate key of atlas-ssh" }));

    expect(screen.queryByRole("button", { name: "Rotate atlas-ssh" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit metadata of atlas-ssh" })).toBeNull();
    expect(
      await screen.findByRole("alertdialog", { name: "Rotate the key of atlas-ssh?" }),
    ).toBeTruthy();
  });

  it("offers Rotate key only on an ssh row and not on a github row", async () => {
    vi.mocked(credentialsApi.listCredentialPlatforms).mockResolvedValue(REPOSITORY_PLATFORMS);
    vi.mocked(credentialsApi.listCredentialPage).mockResolvedValue({
      items: [{ ...OPENROUTER, name: "atlas-github", platform: "github" }, SSH_KEY_CREDENTIAL],
      next_cursor: null,
    });
    mount("repository", "/repositories");

    expect(await screen.findByRole("button", { name: "Rotate key of atlas-ssh" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Rotate atlas-github" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Rotate key of atlas-github" })).toBeNull();
  });

  it("gates the ssh actions on the platform when the engine answers an older ssh entry", async () => {
    vi.mocked(credentialsApi.listCredentialPlatforms).mockResolvedValue({
      items: [apiKey("ssh", ["host", "hostname", "identity_file"], true)],
    });
    vi.mocked(credentialsApi.listCredentialPage).mockResolvedValue({
      items: [SSH_KEY_CREDENTIAL],
      next_cursor: null,
    });
    mount("repository", "/repositories");

    expect(await screen.findByRole("button", { name: "Rotate key of atlas-ssh" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Rotate atlas-ssh" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit metadata of atlas-ssh" })).toBeNull();
  });

  it("shows the Host keys panel only in the repository section", async () => {
    vi.mocked(credentialsApi.listCredentialPage).mockResolvedValue({
      items: [],
      next_cursor: null,
    });
    const { unmount } = mount("repository", "/repositories");

    expect(await screen.findByRole("heading", { name: "Host keys" })).toBeTruthy();
    expect(credentialsApi.listHostKeys).toHaveBeenCalledTimes(1);
    unmount();

    mount();
    await screen.findByText("No credentials. Create the first one with New credential.");
    expect(screen.queryByRole("heading", { name: "Host keys" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Create SSH key" })).toBeNull();
  });

  it("reports a failed read", async () => {
    vi.mocked(credentialsApi.listCredentialPage).mockRejectedValue(
      new ApiError("unavailable", "The daemon did not answer.", 503),
    );
    mount();

    expect(await screen.findByText("The daemon did not answer.")).toBeTruthy();
  });
});
