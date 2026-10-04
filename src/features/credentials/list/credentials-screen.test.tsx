import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as credentialsApi from "@/api/resources/credentials";
import * as gatewayApi from "@/api/resources/gateway";
import type {
  Credential,
  CredentialPlatformEntry,
  CredentialPlatformList,
  HealthOwner,
} from "@/api/types";

vi.mock("@/api/resources/credentials");
vi.mock("@/api/resources/gateway");

import { CredentialsScreen } from "./credentials-screen";
import { utcDateTime } from "@/lib/format";

const GITHUB: Credential = {
  name: "ci-github",
  platform: "github",
  revisions: [
    {
      id: "credential_01J9ZQ4XKM3B6V8N2R5T7W0YAD",
      revision: 2,
      metadata: null,
      createdAt: Date.UTC(2026, 9, 3, 14, 5),
      endedAt: null,
    },
    {
      id: "credential_01J9ZQ4XKM3B6V8N2R5T7W0YAC",
      revision: 1,
      metadata: null,
      createdAt: Date.UTC(2026, 9, 2, 9, 0),
      endedAt: Date.UTC(2026, 9, 3, 14, 5),
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
      metadata: { baseUrl: "https://openrouter.ai/api/v1", models: [] },
      createdAt: Date.UTC(2026, 9, 1, 8, 0),
      endedAt: null,
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
      createdAt: Date.UTC(2026, 9, 1, 8, 0),
      endedAt: null,
    },
  ],
};

function apiKey(
  platform: string,
  metadataFields: readonly string[],
  verifiable: boolean,
): CredentialPlatformEntry {
  return { platform, secretShape: "api_key", loginModes: [], metadataFields, verifiable };
}

const PLATFORMS: CredentialPlatformList = {
  items: [
    { kind: "git", platforms: [apiKey("github", [], true)] },
    {
      kind: "llm",
      platforms: [
        apiKey("openai-compatible", ["baseUrl"], true),
        apiKey("openrouter", [], true),
        apiKey("amazon-bedrock", ["region"], false),
      ],
    },
    {
      kind: "storage",
      platforms: [
        {
          platform: "s3",
          secretShape: "s3_access_key",
          loginModes: [],
          metadataFields: ["endpoint", "bucket", "region"],
          verifiable: true,
        },
      ],
    },
  ],
};

const EMPTY_OWNER: HealthOwner = { global: {}, projects: {} };

function mount() {
  return render(
    <MemoryRouter initialEntries={["/credentials"]}>
      <Routes>
        <Route path="/credentials" element={<CredentialsScreen />} />
        <Route path="/credentials/new" element={<p>New credential form</p>} />
        <Route path="/credentials/:credentialName" element={<p>Credential view</p>} />
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
      items: [GITHUB, ROUTER],
      nextCursor: null,
    });
    mount();

    const list = await screen.findByRole("list", { name: "Credentials" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByText("github")).toBeTruthy();
    expect(within(items[0]!).getByText("r2")).toBeTruthy();
    expect(within(items[0]!).getByText("2026-10-03 14:05 UTC")).toBeTruthy();
    expect(credentialsApi.listCredentialPage).toHaveBeenCalledWith(null, null, false);
  });

  it("opens a credential from its row", async () => {
    vi.mocked(credentialsApi.listCredentialPage).mockResolvedValue({
      items: [GITHUB],
      nextCursor: null,
    });
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Open ci-github" }));

    expect(screen.getByText("Credential view")).toBeTruthy();
  });

  it("filters the list by platform", async () => {
    vi.mocked(credentialsApi.listCredentialPage).mockResolvedValue({
      items: [GITHUB],
      nextCursor: null,
    });
    mount();

    await screen.findByRole("button", { name: "Verify ci-github" });
    await filterBy("openai-compatible", "openai-compatible");

    expect(credentialsApi.listCredentialPage).toHaveBeenLastCalledWith(
      "openai-compatible",
      null,
      false,
    );

    await filterBy("openrouter", "openrouter");

    expect(credentialsApi.listCredentialPage).toHaveBeenLastCalledWith("openrouter", null, false);

    await filterBy("All", "All platforms");

    expect(credentialsApi.listCredentialPage).toHaveBeenLastCalledWith(null, null, false);
  });

  it("offers All platforms first and the platforms grouped by kind", async () => {
    vi.mocked(credentialsApi.listCredentialPage).mockResolvedValue({
      items: [GITHUB],
      nextCursor: null,
    });
    mount();

    await screen.findByRole("button", { name: "Verify ci-github" });
    const input = screen.getByRole("combobox", { name: "Platform" });
    expect((input as HTMLInputElement).value).toBe("All platforms");
    await userEvent.clear(input);
    await userEvent.type(input, "a");

    const options = await screen.findAllByRole("option");
    expect(options[0]?.textContent).toBe("All platforms");
    expect(screen.getByRole("group", { name: "LLM" })).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Git" })).toBeNull();

    await userEvent.type(input, "mazon");
    expect(screen.getByRole("option", { name: "amazon-bedrock" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "openrouter" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Storage" })).toBeNull();
  });

  it("disables Verify for a platform that is not verifiable and says why on a tap", async () => {
    vi.mocked(credentialsApi.listCredentialPage).mockResolvedValue({
      items: [BEDROCK, GITHUB],
      nextCursor: null,
    });
    mount();

    expect(await screen.findByRole("button", { name: "Verify ci-github" })).toBeEnabled();
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
    expect(gatewayApi.readHealthReport).not.toHaveBeenCalled();
  });

  it("opens the Verify tooltip on hover", async () => {
    vi.mocked(credentialsApi.listCredentialPage).mockResolvedValue({
      items: [BEDROCK],
      nextCursor: null,
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
      revisions: ROUTER.revisions.map((entry) => ({ ...entry, endedAt: Date.UTC(2026, 9, 2) })),
    };
    vi.mocked(credentialsApi.listCredentialPage).mockImplementation(
      async (_platform, _cursor, includeArchived) => ({
        items: includeArchived === true ? [GITHUB, ARCHIVED] : [GITHUB],
        nextCursor: null,
      }),
    );
    mount();

    await screen.findByRole("button", { name: "Verify ci-github" });
    expect(screen.queryByText("Archived")).toBeNull();

    await userEvent.click(screen.getByRole("switch", { name: "Include archived" }));

    expect(credentialsApi.listCredentialPage).toHaveBeenLastCalledWith(null, null, true);
    expect((await screen.findAllByText("Archived")).length).toBe(2);
    expect(screen.getAllByText(utcDateTime(Date.UTC(2026, 9, 2))).length).toBeGreaterThan(0);
    expect(screen.queryByText("Updated")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Revisions of legacy" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Verify legacy" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Rotate legacy" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit metadata of legacy" })).toBeNull();
  });

  it("verifies one credential from its row", async () => {
    vi.mocked(credentialsApi.listCredentialPage).mockResolvedValue({
      items: [GITHUB, ROUTER],
      nextCursor: null,
    });
    vi.mocked(gatewayApi.readHealthReport).mockResolvedValue({
      services: { project: EMPTY_OWNER, intake: EMPTY_OWNER, worker: EMPTY_OWNER },
      shared: {
        custody: {
          global: {
            "ci-github": { status: "unhealthy", capability: "rate-limit read" },
            router: { status: "healthy", capability: "model-list read" },
          },
          projects: {},
        },
      },
    });
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Verify ci-github" }));

    const items = within(screen.getByRole("list", { name: "Credentials" })).getAllByRole(
      "listitem",
    );
    expect(await within(items[0]!).findByText("unhealthy")).toBeTruthy();
    expect(within(items[0]!).getByText("Capability: rate-limit read")).toBeTruthy();
    expect(within(items[1]!).queryByText("healthy")).toBeNull();
    expect(gatewayApi.readHealthReport).toHaveBeenCalledTimes(1);
  });

  it("reports a failed health report on the row", async () => {
    vi.mocked(credentialsApi.listCredentialPage).mockResolvedValue({
      items: [GITHUB],
      nextCursor: null,
    });
    vi.mocked(gatewayApi.readHealthReport).mockRejectedValue(
      new ApiError("unavailable", "Down.", 503, "gateway.healthcheck.inventory_failed", {
        missingInventories: ["custody"],
      }),
    );
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Verify ci-github" }));

    expect(
      await screen.findByText(
        "The health report could not read the inventory of: custody. Try again later.",
      ),
    ).toBeTruthy();
  });

  it("rotates a credential from its row", async () => {
    vi.mocked(credentialsApi.listCredentialPage).mockResolvedValue({
      items: [GITHUB],
      nextCursor: null,
    });
    vi.mocked(credentialsApi.rotateCredential).mockResolvedValue(GITHUB);
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Rotate ci-github" }));
    const sheet = await screen.findByRole("dialog");
    await userEvent.type(within(sheet).getByLabelText("API key"), "ghp-2");
    await userEvent.click(within(sheet).getByRole("button", { name: "Rotate secret" }));

    expect(credentialsApi.rotateCredential).toHaveBeenCalledWith("ci-github", {
      expectedRevision: 2,
      secret: { key: "ghp-2" },
    });
  });

  it("offers a metadata edit only for a platform with metadata", async () => {
    vi.mocked(credentialsApi.listCredentialPage).mockResolvedValue({
      items: [GITHUB, ROUTER],
      nextCursor: null,
    });
    mount();

    expect(await screen.findByRole("button", { name: "Edit metadata of router" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Edit metadata of ci-github" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Revisions of router" }));

    expect(screen.getByText("Credential view")).toBeTruthy();
  });

  it("offers the new credential form and the sign-in", async () => {
    vi.mocked(credentialsApi.listCredentialPage).mockResolvedValue({ items: [], nextCursor: null });
    mount();

    expect(
      await screen.findByText("No credentials. Create the first one with New credential."),
    ).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "New credential" }));

    expect(screen.getByText("New credential form")).toBeTruthy();
  });

  it("reports a failed read", async () => {
    vi.mocked(credentialsApi.listCredentialPage).mockRejectedValue(
      new ApiError("unavailable", "The daemon did not answer.", 503),
    );
    mount();

    expect(await screen.findByText("The daemon did not answer.")).toBeTruthy();
  });
});
