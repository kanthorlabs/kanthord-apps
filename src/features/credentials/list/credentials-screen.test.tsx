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

const OPENROUTER: Credential = {
  name: "ci-openrouter",
  platform: "openrouter",
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

const UNHEALTHY: HealthEntry = { status: "unhealthy", capability: "rate-limit read" };
const HEALTHY: HealthEntry = { status: "healthy", capability: "rate-limit read" };

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
});

describe("CredentialsScreen", () => {
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
    expect(credentialsApi.listCredentialPage).toHaveBeenCalledWith("llm", null, null, false);
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
    );

    await filterBy("openrouter", "openrouter");

    expect(credentialsApi.listCredentialPage).toHaveBeenLastCalledWith(
      "llm",
      "openrouter",
      null,
      false,
    );

    await filterBy("All", "All platforms");

    expect(credentialsApi.listCredentialPage).toHaveBeenLastCalledWith("llm", null, null, false);
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
      await screen.findByText("Verification is not supported yet for amazon-bedrock.", undefined, {
        timeout: 300,
      }),
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
      await screen.findByText("Verification is not supported yet for amazon-bedrock.", undefined, {
        timeout: 2000,
      }),
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

    expect(credentialsApi.listCredentialPage).toHaveBeenLastCalledWith("llm", null, null, true);
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

    expect(credentialsApi.listCredentialPage).toHaveBeenCalledWith("repository", null, null, false);
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

  it("reports a failed read", async () => {
    vi.mocked(credentialsApi.listCredentialPage).mockRejectedValue(
      new ApiError("unavailable", "The daemon did not answer.", 503),
    );
    mount();

    expect(await screen.findByText("The daemon did not answer.")).toBeTruthy();
  });
});
