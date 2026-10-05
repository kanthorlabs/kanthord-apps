import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type * as Sonner from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as credentialsApi from "@/api/resources/credentials";
import type {
  CredentialComponent,
  CredentialPlatformEntry,
  CredentialPlatformList,
  HealthEntry,
  LlmCredential,
} from "@/api/types";

vi.mock("@/api/resources/credentials");
vi.mock("sonner", async (importOriginal) => ({
  ...(await importOriginal<typeof Sonner>()),
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import { toast } from "sonner";
import { CredentialScreen } from "./credential-screen";

const BASE_URL = "https://openrouter.ai/api/v1";

const ROUTER: LlmCredential = {
  name: "router",
  platform: "openai-compatible",
  agentProviders: [],
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
function apiKey(
  platform: string,
  metadataFields: readonly string[],
  verifiable: boolean,
): CredentialPlatformEntry {
  return { platform, secretShape: "api_key", loginModes: [], metadataFields, verifiable };
}

const PLATFORMS: CredentialPlatformList = {
  items: [
    apiKey("openrouter", [], true),
    apiKey("openai-compatible", ["baseUrl"], true),
    apiKey("cloudflare-ai-gateway", ["account_id", "gateway_id"], false),
  ],
};

const GATEWAY: LlmCredential = {
  name: "gateway",
  platform: "cloudflare-ai-gateway",
  agentProviders: [],
  revisions: [
    {
      id: "credential_01J9ZQ4XKM3B6V8N2R5T7W0YAH",
      revision: 1,
      metadata: { account_id: "acc-1", gateway_id: "gw-1" },
      createdAt: Date.UTC(2026, 9, 3, 14, 5),
      endedAt: null,
    },
  ],
};

const HEALTHY: HealthEntry = { status: "healthy", capability: "model-list read" };

function mount(component: CredentialComponent = "llm", section = "/llm") {
  return render(
    <MemoryRouter initialEntries={[`${section}/router`]}>
      <Routes>
        <Route
          path={`${section}/:credentialName`}
          element={<CredentialScreen component={component} />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

function mountWithList(component: CredentialComponent = "llm", section = "/llm") {
  return render(
    <MemoryRouter initialEntries={[`${section}/router`]}>
      <Routes>
        <Route
          path={`${section}/:credentialName`}
          element={<CredentialScreen component={component} />}
        />
        <Route path={section} element={<p>Credential list</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(credentialsApi.readCredential).mockResolvedValue(ROUTER);
  vi.mocked(credentialsApi.listCredentialPlatforms).mockResolvedValue(PLATFORMS);
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
    expect(credentialsApi.readCredential).toHaveBeenCalledWith("llm", "router");
    expect(credentialsApi.listCredentialPlatforms).toHaveBeenCalledWith("llm");
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

    expect(credentialsApi.revokeCredentialRevision).toHaveBeenCalledWith("llm", "router", 2);
  });

  it("archives after the confirmation and returns to the list", async () => {
    vi.mocked(credentialsApi.archiveCredential).mockResolvedValue(ROUTER);
    mountWithList();

    await userEvent.click(await screen.findByRole("button", { name: "Archive" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/Every live revision of router ends at once\./)).toBeTruthy();
    expect(within(dialog).getByText(/The record stays/)).toBeTruthy();
    await userEvent.click(within(dialog).getByRole("button", { name: "Archive router" }));

    expect(credentialsApi.archiveCredential).toHaveBeenCalledWith("llm", "router");
    expect(await screen.findByText("Credential list")).toBeTruthy();
    expect(toast.success).toHaveBeenCalled();
  });

  it("states that an archive is final in the confirmation", async () => {
    mountWithList();

    await userEvent.click(await screen.findByRole("button", { name: "Archive" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText(/An archive is final, and the name stays taken\./),
    ).toBeTruthy();
  });

  it("marks an archived credential and hides every write action", async () => {
    const ended = Date.UTC(2026, 9, 4);
    vi.mocked(credentialsApi.readCredential).mockResolvedValue({
      ...ROUTER,
      revisions: ROUTER.revisions.map((entry) => ({ ...entry, endedAt: ended })),
    });
    mount();

    expect(await screen.findByText("Archived")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Archive" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Rotate secret" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit metadata" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Revoke revision/ })).toBeNull();
  });

  it("shows the dependents of a refused archive and stays on the detail", async () => {
    vi.mocked(credentialsApi.archiveCredential).mockRejectedValue(
      new ApiError("conflict", "In use.", 409, "credential.credential.in_use", {
        agentProviders: ["codex"],
        bindings: ["binding_1"],
      }),
    );
    mountWithList();

    await userEvent.click(await screen.findByRole("button", { name: "Archive" }));
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Archive router" }));

    const alert = await within(dialog).findByRole("alert");
    expect(alert.textContent).toMatch(/agentProviders: codex; bindings: binding_1/);
    expect(screen.queryByText("Credential list")).toBeNull();
  });

  it("rotates the secret at the newest live revision and copies the metadata", async () => {
    vi.mocked(credentialsApi.rotateCredential).mockResolvedValue(ROUTER);
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Rotate secret" }));
    const sheet = await screen.findByRole("dialog");
    await userEvent.type(within(sheet).getByLabelText("API key"), "sk-2");
    await userEvent.click(within(sheet).getByRole("button", { name: "Rotate secret" }));

    expect(credentialsApi.rotateCredential).toHaveBeenCalledWith("llm", "router", {
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

    expect(credentialsApi.updateCredentialMetadata).toHaveBeenCalledWith("llm", "router", {
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
      new ApiError("conflict", "In use.", 409, "llm.metadata.model_in_use", {
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

  it("verifies the credential with a header badge and fixed facts", async () => {
    let answer: (entry: HealthEntry) => void = () => {};
    vi.mocked(credentialsApi.verifyCredential).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    mount();

    const verify = await screen.findByRole("button", { name: "Verify" });
    const section = screen.getByRole("region", { name: "Credential" });
    expect(screen.getByText("Capability").nextElementSibling?.textContent).toBe("—");
    expect(screen.getByText("Checked").nextElementSibling?.textContent).toBe("—");

    await userEvent.click(verify);

    expect(within(section).getByRole("status").textContent).toBe("Checking");
    expect(verify).toBeDisabled();
    expect(verify).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText(/can take up to 2 minutes/)).toBeNull();

    answer(HEALTHY);

    await waitFor(() => expect(within(section).getByRole("status").textContent).toBe("Healthy"));
    expect(credentialsApi.verifyCredential).toHaveBeenCalledWith("llm", "router");
    expect(verify).toBeEnabled();
    expect(screen.getByText("Capability").nextElementSibling?.textContent).toBe("model-list read");
    expect(screen.getByText("Checked").nextElementSibling?.textContent).toMatch(/ UTC$/);
  });

  it("reports a failed verify with a badge and a toast that retries", async () => {
    vi.mocked(credentialsApi.verifyCredential).mockRejectedValueOnce(
      new ApiError("refused", "No check.", 400, "credential.check.unsupported"),
    );
    vi.mocked(credentialsApi.verifyCredential).mockResolvedValueOnce(HEALTHY);
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Verify" }));

    const section = screen.getByRole("region", { name: "Credential" });
    await waitFor(() =>
      expect(within(section).getByRole("status").textContent).toBe("Check failed"),
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "Verify" })).toBeEnabled();
    expect(screen.getByText("Capability").nextElementSibling?.textContent).toBe("—");
    expect(toast.error).toHaveBeenCalledWith("Verifying router failed.", {
      description:
        "This platform has no check before the save. Save the credential, then use Verify.",
      action: { label: "Retry", onClick: expect.any(Function) },
    });

    const retry = vi.mocked(toast.error).mock.calls[0]![1]!.action as Sonner.Action;
    act(() => retry.onClick({} as Parameters<Sonner.Action["onClick"]>[0]));

    await waitFor(() => expect(within(section).getByRole("status").textContent).toBe("Healthy"));
    expect(credentialsApi.verifyCredential).toHaveBeenCalledTimes(2);
  });

  it("offers no metadata edit for a platform without metadata", async () => {
    vi.mocked(credentialsApi.readCredential).mockResolvedValue({
      name: "openrouter",
      platform: "openrouter",
      agentProviders: [],
      revisions: [{ ...ROUTER.revisions[0]!, metadata: null }],
    });
    mount();

    expect(await screen.findByRole("button", { name: "Rotate secret" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Edit metadata" })).toBeNull();
  });

  it("edits each metadata field of the platform under its exact name", async () => {
    vi.mocked(credentialsApi.readCredential).mockResolvedValue(GATEWAY);
    vi.mocked(credentialsApi.updateCredentialMetadata).mockResolvedValue(GATEWAY);
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Edit metadata" }));
    const sheet = await screen.findByRole("dialog");
    const gateway = within(sheet).getByLabelText("gateway_id");
    expect((within(sheet).getByLabelText("account_id") as HTMLInputElement).value).toBe("acc-1");
    await userEvent.clear(gateway);
    await userEvent.type(gateway, "gw-2");
    await userEvent.click(within(sheet).getByRole("button", { name: "Save metadata" }));

    expect(credentialsApi.updateCredentialMetadata).toHaveBeenCalledWith("llm", "gateway", {
      expectedRevision: 1,
      metadata: { account_id: "acc-1", gateway_id: "gw-2" },
    });
  });

  it("disables Verify for a platform that is not verifiable and says why on focus", async () => {
    vi.mocked(credentialsApi.readCredential).mockResolvedValue(GATEWAY);
    mount();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Verify" })).toHaveAttribute(
        "aria-disabled",
        "true",
      ),
    );
    const trigger = screen.getByRole("button", { name: "Verify" });
    for (let step = 0; step < 10 && document.activeElement !== trigger; step += 1) {
      await userEvent.tab();
    }
    expect(trigger).toHaveFocus();

    expect(
      await screen.findByText("Verification is not supported yet for cloudflare-ai-gateway."),
    ).toBeTruthy();
    expect(credentialsApi.verifyCredential).not.toHaveBeenCalled();
  });

  it("archives a storage credential through its section and returns to that list", async () => {
    vi.mocked(credentialsApi.readCredential).mockResolvedValue({
      name: "router",
      platform: "s3",
      bindings: [],
      revisions: [{ ...ROUTER.revisions[0]!, metadata: null }],
    });
    vi.mocked(credentialsApi.archiveCredential).mockResolvedValue(ROUTER);
    mountWithList("storage", "/storage");

    await userEvent.click(await screen.findByRole("button", { name: "Archive" }));
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Archive router" }));

    expect(credentialsApi.readCredential).toHaveBeenCalledWith("storage", "router");
    expect(credentialsApi.listCredentialPlatforms).toHaveBeenCalledWith("storage");
    expect(credentialsApi.archiveCredential).toHaveBeenCalledWith("storage", "router");
    expect(await screen.findByText("Credential list")).toBeTruthy();
  });

  it("reports an unknown credential", async () => {
    vi.mocked(credentialsApi.readCredential).mockRejectedValue(
      new ApiError("not_found", "Credential not found.", 404, "credential.credential.not_found"),
    );
    mount();

    expect(await screen.findByText("Credential not found.")).toBeTruthy();
  });
});
