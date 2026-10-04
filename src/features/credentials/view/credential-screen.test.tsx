import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type * as Sonner from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as credentialsApi from "@/api/resources/credentials";
import * as gatewayApi from "@/api/resources/gateway";
import type { Credential, HealthOwner } from "@/api/types";

vi.mock("@/api/resources/credentials");
vi.mock("@/api/resources/gateway");
vi.mock("sonner", async (importOriginal) => ({
  ...(await importOriginal<typeof Sonner>()),
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import { CredentialScreen } from "./credential-screen";

const BASE_URL = "https://openrouter.ai/api/v1";

const ROUTER: Credential = {
  name: "router",
  platform: "openai-compatible",
  revisions: [
    {
      id: "credential_01J9ZQ4XKM3B6V8N2R5T7W0YAG",
      revision: 3,
      metadata: { baseUrl: BASE_URL, models: [{ id: "qwen-plus" }] },
      createdAt: Date.UTC(2026, 9, 3, 14, 5),
      endedAt: null,
    },
    {
      id: "credential_01J9ZQ4XKM3B6V8N2R5T7W0YAF",
      revision: 2,
      metadata: { baseUrl: BASE_URL, models: [] },
      createdAt: Date.UTC(2026, 9, 2, 14, 5),
      endedAt: null,
    },
    {
      id: "credential_01J9ZQ4XKM3B6V8N2R5T7W0YAE",
      revision: 1,
      metadata: { baseUrl: BASE_URL, models: [] },
      createdAt: Date.UTC(2026, 9, 1, 14, 5),
      endedAt: Date.UTC(2026, 9, 2, 14, 5),
    },
  ],
};
const EMPTY_OWNER: HealthOwner = { global: {}, projects: {} };

function mount() {
  return render(
    <MemoryRouter initialEntries={["/credentials/router"]}>
      <Routes>
        <Route path="/credentials/:credentialName" element={<CredentialScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(credentialsApi.readCredential).mockResolvedValue(ROUTER);
});

describe("CredentialScreen", () => {
  it("lists every revision newest first with its state and metadata", async () => {
    mount();

    const list = await screen.findByRole("list", { name: "Revisions" });
    const items = within(list).getAllByRole("listitem");
    expect(items.map((item) => within(item).getByText(/^Revision \d$/).textContent)).toEqual([
      "Revision 3",
      "Revision 2",
      "Revision 1",
    ]);
    expect(within(items[0]!).getByText("newest")).toBeTruthy();
    expect(within(items[0]!).getByText("qwen-plus")).toBeTruthy();
    expect(within(items[2]!).getByText("ended")).toBeTruthy();
    expect(within(items[2]!).getByText("2026-10-02 14:05 UTC")).toBeTruthy();
    expect(credentialsApi.readCredential).toHaveBeenCalledWith("router");
  });

  it("offers a revoke only for an older live revision", async () => {
    mount();

    await screen.findByRole("list", { name: "Revisions" });
    expect(screen.getAllByRole("button", { name: /^Revoke revision/ })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Revoke revision 2" })).toBeTruthy();
  });

  it("revokes after the confirmation names the consequence", async () => {
    vi.mocked(credentialsApi.revokeCredentialRevision).mockResolvedValue(ROUTER);
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Revoke revision 2" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/A revoke cannot be undone\./)).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Keep revision 2" })).toBeTruthy();
    await userEvent.click(within(dialog).getByRole("button", { name: "Revoke revision 2" }));

    expect(credentialsApi.revokeCredentialRevision).toHaveBeenCalledWith("router", 2);
  });

  it("rotates the secret at the newest live revision and copies the metadata", async () => {
    vi.mocked(credentialsApi.rotateCredential).mockResolvedValue(ROUTER);
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Rotate secret" }));
    const sheet = await screen.findByRole("dialog");
    await userEvent.type(within(sheet).getByLabelText("API key"), "sk-2");
    await userEvent.click(within(sheet).getByRole("button", { name: "Rotate secret" }));

    expect(credentialsApi.rotateCredential).toHaveBeenCalledWith("router", {
      expectedRevision: 3,
      secret: { key: "sk-2" },
    });
  });

  it("offers a reload when the expected revision is stale", async () => {
    vi.mocked(credentialsApi.rotateCredential).mockRejectedValue(
      new ApiError("conflict", "Stale.", 409, "credential.revision.conflict"),
    );
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Rotate secret" }));
    const sheet = await screen.findByRole("dialog");
    await userEvent.type(within(sheet).getByLabelText("API key"), "sk-2");
    await userEvent.click(within(sheet).getByRole("button", { name: "Rotate secret" }));

    expect(await within(sheet).findByText("The credential changed.")).toBeTruthy();
    expect((within(sheet).getByLabelText("API key") as HTMLInputElement).value).toBe("");
    await userEvent.click(within(sheet).getByRole("button", { name: "Reload" }));

    expect(credentialsApi.readCredential).toHaveBeenCalledTimes(2);
  });

  it("adds an approved model through a metadata edit and keeps the base URL", async () => {
    vi.mocked(credentialsApi.updateCredentialMetadata).mockResolvedValue(ROUTER);
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Edit metadata" }));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByLabelText("Base URL").hasAttribute("readonly")).toBe(true);
    await userEvent.click(within(sheet).getByRole("button", { name: "Add model" }));
    const ids = within(sheet).getAllByLabelText("Model ID");
    await userEvent.type(ids[1]!, "qwen-max");
    const maxTokens = within(sheet).getAllByLabelText("Max tokens");
    await userEvent.type(maxTokens[1]!, "8192");
    const levels = within(sheet).getAllByRole("group", { name: "Reasoning levels" });
    await userEvent.click(within(levels[1]!).getByRole("button", { name: "high" }));
    await userEvent.click(within(sheet).getByRole("button", { name: "Save metadata" }));

    expect(credentialsApi.updateCredentialMetadata).toHaveBeenCalledWith("router", {
      expectedRevision: 3,
      metadata: {
        baseUrl: BASE_URL,
        models: [
          { id: "qwen-plus" },
          { id: "qwen-max", maxTokens: 8192, reasoningLevels: ["high"] },
        ],
      },
    });
  });

  it("explains a model that an agent still uses", async () => {
    vi.mocked(credentialsApi.updateCredentialMetadata).mockRejectedValue(
      new ApiError("conflict", "In use.", 409, "credential.metadata.model_in_use", {
        models: [{ model: "qwen-plus", agents: ["swe@1"] }],
      }),
    );
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Edit metadata" }));
    const sheet = await screen.findByRole("dialog");
    await userEvent.click(within(sheet).getByRole("button", { name: "Remove qwen-plus" }));
    await userEvent.click(within(sheet).getByRole("button", { name: "Save metadata" }));

    expect(await within(sheet).findByText(/In use: qwen-plus \(agents: swe@1\)\./)).toBeTruthy();
  });

  it("verifies the credential through the health report", async () => {
    vi.mocked(gatewayApi.readHealthReport).mockResolvedValue({
      services: { project: EMPTY_OWNER, intake: EMPTY_OWNER, worker: EMPTY_OWNER },
      shared: {
        custody: {
          global: { router: { status: "healthy", capability: "model-list read" } },
          projects: {},
        },
      },
    });
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Verify" }));

    expect(await screen.findByText("healthy")).toBeTruthy();
    expect(screen.getByText("Capability: model-list read")).toBeTruthy();
  });

  it("offers no metadata edit for a platform without metadata", async () => {
    vi.mocked(credentialsApi.readCredential).mockResolvedValue({
      name: "ci-github",
      platform: "github",
      revisions: [{ ...ROUTER.revisions[0]!, metadata: null }],
    });
    mount();

    expect(await screen.findByRole("button", { name: "Rotate secret" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Edit metadata" })).toBeNull();
  });

  it("reports an unknown credential", async () => {
    vi.mocked(credentialsApi.readCredential).mockRejectedValue(
      new ApiError("not_found", "Credential not found.", 404, "credential.credential.not_found"),
    );
    mount();

    expect(await screen.findByText("Credential not found.")).toBeTruthy();
  });
});
