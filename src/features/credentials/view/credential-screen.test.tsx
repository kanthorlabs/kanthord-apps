import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type * as Sonner from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as credentialsApi from "@/api/resources/credentials";
import * as workersApi from "@/api/resources/workers";
import type {
  AgentSummary,
  CredentialComponent,
  CredentialPlatformEntry,
  CredentialPlatformList,
  HealthEntry,
  LlmCredential,
  RepositoryCredential,
} from "@/api/types";

vi.mock("@/api/resources/credentials");
vi.mock("@/api/resources/workers");
vi.mock("sonner", async (importOriginal) => ({
  ...(await importOriginal<typeof Sonner>()),
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import { toast } from "sonner";
import { utcDateTime } from "@/lib/format";
import { CredentialScreen } from "./credential-screen";
import { textContent } from "../../../../test/text-content";

const BASE_URL = "https://openrouter.ai/api/v1";

const ROUTER: LlmCredential = {
  name: "router",
  platform: "openai-compatible",
  holder: "server",
  sealed_to: null,
  sealed_current: true,
  agent_providers: [],
  revisions: [
    {
      id: "credential_01J9ZQ4XKM3B6V8N2R5T7W0YAG",
      revision: 3,
      metadata: { base_url: BASE_URL, models: [{ id: "qwen-plus" }] },
      created_at: Date.UTC(2026, 9, 3, 14, 5),
      ended_at: null,
    },
    {
      id: "credential_01J9ZQ4XKM3B6V8N2R5T7W0YAF",
      revision: 2,
      metadata: { base_url: BASE_URL, models: [] },
      created_at: Date.UTC(2026, 9, 2, 14, 5),
      ended_at: null,
    },
    {
      id: "credential_01J9ZQ4XKM3B6V8N2R5T7W0YAE",
      revision: 1,
      metadata: { base_url: BASE_URL, models: [] },
      created_at: Date.UTC(2026, 9, 1, 14, 5),
      ended_at: Date.UTC(2026, 9, 2, 14, 5),
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
    apiKey("openrouter", [], true),
    apiKey("openai-compatible", ["base_url"], true),
    apiKey("cloudflare-ai-gateway", ["account_id", "gateway_id"], false),
  ],
};

const GATEWAY: LlmCredential = {
  name: "gateway",
  platform: "cloudflare-ai-gateway",
  holder: "server",
  sealed_to: null,
  sealed_current: true,
  agent_providers: [],
  revisions: [
    {
      id: "credential_01J9ZQ4XKM3B6V8N2R5T7W0YAH",
      revision: 1,
      metadata: { account_id: "acc-1", gateway_id: "gw-1" },
      created_at: Date.UTC(2026, 9, 3, 14, 5),
      ended_at: null,
    },
  ],
};

const HEALTHY: HealthEntry = {
  status: "healthy",
  capability: "model-list read",
  failure_reason: null,
};

function mount(
  component: CredentialComponent = "llm",
  section = "/llm",
  state: unknown = undefined,
) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: `${section}/router`, state }]}>
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
  vi.mocked(workersApi.listAgents).mockResolvedValue([]);
  vi.mocked(workersApi.listAgentCooldowns).mockResolvedValue([]);
  vi.mocked(credentialsApi.verifyCredential).mockResolvedValue(HEALTHY);
});

const AGENTS: readonly AgentSummary[] = [
  { agentName: "re@1", workerNames: ["reviewer@1"], enablement: null },
  { agentName: "swe@1", workerNames: ["coder@1"], enablement: null },
];

describe("CredentialScreen", () => {
  it("shows the live cooldown of the credential with its strikes and its end", async () => {
    const end = Date.now() + 120_000;
    vi.mocked(workersApi.listAgentCooldowns).mockResolvedValue([
      { credential: "other", strikes: 4, available_at: end },
      { credential: "router", strikes: 2, available_at: end },
    ]);
    mount();

    const section = await screen.findByRole("region", { name: "Cooldown" });
    expect(
      await within(section).findByText(
        `Strike 2. Claims skip this credential until ${utcDateTime(end)}.`,
      ),
    ).toBeTruthy();
  });

  it("keeps the strikes of an ended cooldown", async () => {
    vi.mocked(workersApi.listAgentCooldowns).mockResolvedValue([
      { credential: "router", strikes: 5, available_at: Date.now() - 1_000 },
    ]);
    mount();

    const section = await screen.findByRole("region", { name: "Cooldown" });
    expect(
      await within(section).findByText(
        "No live cooldown. Strike 5 stays until a release without a provider failure.",
      ),
    ).toBeTruthy();
  });

  it("states no cooldown and the cooldown rule when the credential holds no strike", async () => {
    vi.mocked(workersApi.listAgentCooldowns).mockResolvedValue([
      { credential: "other", strikes: 1, available_at: Date.now() + 60_000 },
    ]);
    mount();

    const section = await screen.findByRole("region", { name: "Cooldown" });
    expect(
      await within(section).findByText("No cooldown. Claims can use this credential."),
    ).toBeTruthy();
    expect(
      within(section).getByText(
        "A provider failure of rate limited, unavailable or quota exhausted starts a cooldown. Each strike doubles it, up to one day. A release without a provider failure clears it. A claim skips the agent chain entries of a credential in a cooldown.",
      ),
    ).toBeTruthy();
  });

  it("names a failed cooldown read", async () => {
    vi.mocked(workersApi.listAgentCooldowns).mockRejectedValue(
      new ApiError("unavailable", "The daemon is unavailable.", 503),
    );
    mount();

    const section = await screen.findByRole("region", { name: "Cooldown" });
    expect(await within(section).findByText("The daemon is unavailable.")).toBeTruthy();
  });

  it("enables every agent that is not enabled with the credential in one sheet", async () => {
    vi.mocked(workersApi.listAgents).mockResolvedValue(AGENTS);
    vi.mocked(workersApi.listCredentialModels).mockResolvedValue([
      { model_identifier: "qwen-plus", reasoning_efforts: ["off", "medium", "high"] },
    ]);
    vi.mocked(workersApi.putAgentEnablement).mockImplementation((agentName) =>
      Promise.resolve({
        agent_name: agentName,
        state: "enabled",
        agent_providers: [],
        default_configuration: {
          agent_provider: "router",
          model_identifier: "qwen-plus",
          reasoning_effort: "medium",
        },
        fallback_configurations: [],
        revision: 1,
      }),
    );
    mount();

    const section = (await screen.findByRole("heading", { name: "Agents" })).closest(
      "[data-slot='card']",
    ) as HTMLElement;
    expect(await within(section).findByText("Not enabled: re@1, swe@1")).toBeTruthy();
    await userEvent.click(within(section).getByRole("button", { name: "Enable agents" }));
    const sheet = await screen.findByRole("dialog", { name: "Enable agents with router" });
    expect(within(sheet).getByRole("switch", { name: "re@1" })).toBeChecked();
    expect(within(sheet).getByRole("switch", { name: "swe@1" })).toBeChecked();
    await waitFor(() =>
      expect(within(sheet).getByRole("combobox", { name: "Reasoning effort" })).toHaveTextContent(
        "medium",
      ),
    );
    await userEvent.click(within(sheet).getByRole("button", { name: "Enable agents" }));

    await waitFor(() => expect(workersApi.putAgentEnablement).toHaveBeenCalledTimes(2));
    expect(workersApi.putAgentEnablement).toHaveBeenCalledWith("swe@1", {
      agent_providers: [{ name: "router", provider: "openai-compatible", credential: "router" }],
      default_configuration: {
        agent_provider: "router",
        model_identifier: "qwen-plus",
        reasoning_effort: "medium",
      },
      fallback_configurations: [],
    });
    expect(toast.success).toHaveBeenCalledWith(
      "Enabled re@1 at revision 1. Enabled swe@1 at revision 1.",
    );
  });

  it.each([
    ["every agent is enabled", "Every agent of the hosted workers is enabled.", true],
    ["no hosted worker declares an agent", "No hosted worker declares an agent.", false],
  ])("disables Enable agents and says why when %s", async (_case, reason, withAgents) => {
    vi.mocked(workersApi.listAgents).mockResolvedValue(
      withAgents
        ? AGENTS.map((agent) => ({
            ...agent,
            enablement: {
              agent_name: agent.agentName,
              state: "enabled" as const,
              agent_providers: [],
              default_configuration: {
                agent_provider: "router",
                model_identifier: "qwen-plus",
                reasoning_effort: "medium" as const,
              },
              fallback_configurations: [],
              revision: 1,
            },
          }))
        : [],
    );
    mount();

    const section = (await screen.findByRole("heading", { name: "Agents" })).closest(
      "[data-slot='card']",
    ) as HTMLElement;

    expect(await within(section).findByText(reason)).toBeTruthy();
    expect(within(section).getByRole("button", { name: "Enable agents" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("leaves the replace of a disabled enablement off and names what it replaces", async () => {
    vi.mocked(workersApi.listAgents).mockResolvedValue([
      AGENTS[0] as AgentSummary,
      {
        agentName: "swe@1",
        workerNames: ["coder@1"],
        enablement: {
          agent_name: "swe@1",
          state: "disabled",
          agent_providers: [{ name: "atlas", provider: "openai-compatible", credential: "atlas" }],
          default_configuration: {
            agent_provider: "atlas",
            model_identifier: "qwen3-coder",
            reasoning_effort: "off",
          },
          fallback_configurations: [],
          revision: 3,
        },
      },
    ]);
    vi.mocked(workersApi.listCredentialModels).mockResolvedValue([]);
    mount();

    const section = (await screen.findByRole("heading", { name: "Agents" })).closest(
      "[data-slot='card']",
    ) as HTMLElement;
    await within(section).findByText("Not enabled: re@1, swe@1");
    await userEvent.click(within(section).getByRole("button", { name: "Enable agents" }));
    const sheet = await screen.findByRole("dialog", { name: "Enable agents with router" });

    expect(within(sheet).getByRole("switch", { name: "re@1" })).toBeChecked();
    expect(within(sheet).getByRole("switch", { name: "swe@1" })).not.toBeChecked();
    expect(
      within(sheet).getByText(
        /Switch it on to replace the disabled enablement at revision 3\. Its agent providers and fallback configurations are replaced by this configuration/,
      ),
    ).toBeTruthy();
  });

  it("marks each outcome as enabled or not enabled after a partial failure", async () => {
    vi.mocked(workersApi.listAgents).mockResolvedValue(AGENTS);
    vi.mocked(workersApi.listCredentialModels).mockResolvedValue([
      { model_identifier: "qwen-plus", reasoning_efforts: ["medium"] },
    ]);
    vi.mocked(workersApi.putAgentEnablement).mockImplementation((agentName) =>
      agentName === "swe@1"
        ? Promise.reject(new ApiError("conflict", "The model is not approved.", 409))
        : Promise.resolve({
            agent_name: agentName,
            state: "enabled",
            agent_providers: [],
            default_configuration: {
              agent_provider: "router",
              model_identifier: "qwen-plus",
              reasoning_effort: "medium",
            },
            fallback_configurations: [],
            revision: 1,
          }),
    );
    mount();

    const section = (await screen.findByRole("heading", { name: "Agents" })).closest(
      "[data-slot='card']",
    ) as HTMLElement;
    await within(section).findByText("Not enabled: re@1, swe@1");
    await userEvent.click(within(section).getByRole("button", { name: "Enable agents" }));
    const sheet = await screen.findByRole("dialog", { name: "Enable agents with router" });
    await waitFor(() =>
      expect(within(sheet).getByRole("combobox", { name: "Reasoning effort" })).toHaveTextContent(
        "medium",
      ),
    );
    await userEvent.click(within(sheet).getByRole("button", { name: "Enable agents" }));

    const notice = await within(sheet).findByRole("alert");
    expect(notice.textContent).toContain("Enabled: re@1 at revision 1.");
    expect(notice.textContent).toContain("Not enabled: swe@1. The model is not approved.");
    expect(within(notice).getByText("swe@1").tagName).toBe("STRONG");
  });

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
    await waitFor(() => expect(credentialsApi.listCredentialPlatforms).toHaveBeenCalledWith("llm"));
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
    expect(
      within(dialog).getByText(textContent(/Every live revision of router ends at once\./)),
    ).toBeTruthy();
    expect(within(dialog).getByText(/The record stays/)).toBeTruthy();
    expect(within(dialog).getAllByText("router", { selector: "strong" })).toHaveLength(2);
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
      revisions: ROUTER.revisions.map((entry) => ({ ...entry, ended_at: ended })),
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
        agent_providers: [{ agent_name: "swe@1", provider_name: "codex" }],
        bindings: [{ binding_id: "binding_1", project_id: "project_1" }],
      }),
    );
    mountWithList();

    await userEvent.click(await screen.findByRole("button", { name: "Archive" }));
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Archive router" }));

    const alert = await within(dialog).findByRole("alert");
    expect(alert.textContent).toMatch(
      /agent providers: swe@1 \(provider codex\); project bindings: binding_1 of project_1/,
    );
    expect(screen.queryByText("Credential list")).toBeNull();
  });

  it("rotates the secret at the newest live revision and copies the metadata", async () => {
    vi.mocked(credentialsApi.rotateCredential).mockResolvedValue(ROUTER);
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Rotate secret" }));
    const sheet = await screen.findByRole("dialog");
    await userEvent.type(within(sheet).getByLabelText("API Key"), "sk-2");
    await userEvent.click(within(sheet).getByRole("button", { name: "Rotate secret" }));

    expect(credentialsApi.rotateCredential).toHaveBeenCalledWith("llm", "router", {
      expected_revision: 3,
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
    await userEvent.type(within(sheet).getByLabelText("API Key"), "sk-2");
    await userEvent.click(within(sheet).getByRole("button", { name: "Rotate secret" }));

    expect(await within(sheet).findByText("The credential changed.")).toBeTruthy();
    expect((within(sheet).getByLabelText("API Key") as HTMLInputElement).value).toBe("");
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
    const maxTokens = within(sheet).getAllByLabelText("Max Tokens");
    await userEvent.type(maxTokens[1]!, "8192");
    const levels = within(sheet).getAllByRole("group", { name: "Reasoning Levels" });
    await userEvent.click(within(levels[1]!).getByRole("button", { name: "high" }));
    await userEvent.click(within(sheet).getByRole("button", { name: "Save metadata" }));

    expect(credentialsApi.updateCredentialMetadata).toHaveBeenCalledWith(
      "llm",
      "router",
      {
        expected_revision: 3,
        metadata: {
          base_url: BASE_URL,
          models: [
            { id: "qwen-plus" },
            { id: "qwen-max", max_tokens: 8192, reasoning_levels: ["high"] },
          ],
        },
      },
      null,
    );
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

  it("shows the check of the form as the first result", async () => {
    mount("llm", "/llm", {
      priorCheck: { entry: HEALTHY, checkedAt: Date.UTC(2026, 9, 18, 8, 30) },
    });

    const section = await screen.findByRole("region", { name: "Credential" });
    expect(within(section).getByRole("status").textContent).toBe("Healthy");
    expect(screen.getByText("Capability").nextElementSibling?.textContent).toBe("model-list read");
    expect(screen.getByText("Checked").nextElementSibling?.textContent).toBe(
      "2026-10-18 08:30 UTC",
    );
    expect(credentialsApi.verifyCredential).not.toHaveBeenCalled();
  });

  it("shows no result when the navigation carries no check", async () => {
    mount();

    const section = await screen.findByRole("region", { name: "Credential" });
    expect(within(section).getByRole("status").textContent).toBe("");
    expect(screen.getByText("Checked").nextElementSibling?.textContent).toBe("—");
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
      holder: "server",
      sealed_to: null,
      sealed_current: true,
      agent_providers: [],
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
    const gateway = within(sheet).getByLabelText("Gateway ID");
    expect((within(sheet).getByLabelText("Account ID") as HTMLInputElement).value).toBe("acc-1");
    await userEvent.clear(gateway);
    await userEvent.type(gateway, "gw-2");
    await userEvent.click(within(sheet).getByRole("button", { name: "Save metadata" }));

    expect(credentialsApi.updateCredentialMetadata).toHaveBeenCalledWith(
      "llm",
      "gateway",
      {
        expected_revision: 1,
        metadata: { account_id: "acc-1", gateway_id: "gw-2" },
      },
      null,
    );
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
      await screen.findByText(
        textContent("Verification is not supported yet for cloudflare-ai-gateway."),
      ),
    ).toBeTruthy();
    expect(credentialsApi.verifyCredential).not.toHaveBeenCalled();
  });

  it("archives a storage credential through its section and returns to that list", async () => {
    vi.mocked(credentialsApi.readCredential).mockResolvedValue({
      name: "router",
      platform: "s3",
      holder: "server",
      sealed_to: null,
      sealed_current: true,
      bindings: [],
      revisions: [{ ...ROUTER.revisions[0]!, metadata: null }],
    });
    vi.mocked(credentialsApi.archiveCredential).mockResolvedValue(ROUTER);
    mountWithList("storage", "/storage");

    await userEvent.click(await screen.findByRole("button", { name: "Archive" }));
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Archive router" }));

    expect(credentialsApi.readCredential).toHaveBeenCalledWith("storage", "router");
    await waitFor(() =>
      expect(credentialsApi.listCredentialPlatforms).toHaveBeenCalledWith("storage"),
    );
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

describe("CredentialScreen of an ssh credential", () => {
  const OLD_KEY = {
    public_key: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOld kanthord-router",
    fingerprint: "SHA256:oldoldoldoldoldoldoldoldoldoldoldoldoldoldo",
  };
  const NEW_KEY = {
    public_key: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINew kanthord-router",
    fingerprint: "SHA256:newnewnewnewnewnewnewnewnewnewnewnewnewnewn",
  };
  const SSH: RepositoryCredential = {
    name: "router",
    platform: "ssh",
    holder: "server",
    sealed_to: null,
    sealed_current: true,
    bindings: [],
    revisions: [
      {
        id: "credential_01J9ZQ4XKM3B6V8N2R5T7W0YB2",
        revision: 2,
        metadata: NEW_KEY,
        created_at: Date.UTC(2026, 9, 3, 14, 5),
        ended_at: null,
      },
      {
        id: "credential_01J9ZQ4XKM3B6V8N2R5T7W0YB1",
        revision: 1,
        metadata: OLD_KEY,
        created_at: Date.UTC(2026, 9, 1, 14, 5),
        ended_at: null,
      },
    ],
  };
  const SSH_PLATFORMS: CredentialPlatformList = {
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

  beforeEach(() => {
    vi.mocked(credentialsApi.readCredential).mockResolvedValue(SSH);
    vi.mocked(credentialsApi.listCredentialPlatforms).mockResolvedValue(SSH_PLATFORMS);
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, "clipboard");
  });

  it("shows the fingerprint and the public key of each revision with Copy on the newest", async () => {
    mount("repository", "/repositories");

    const list = await screen.findByRole("list", { name: "Revisions" });
    const items = within(list).getAllByRole("listitem");
    expect(within(items[0]!).getByText(NEW_KEY.fingerprint)).toBeTruthy();
    expect(within(items[0]!).getByText(NEW_KEY.public_key)).toBeTruthy();
    expect(within(items[1]!).getByText(OLD_KEY.fingerprint)).toBeTruthy();
    expect(within(items[1]!).queryByRole("button", { name: "Copy public key" })).toBeNull();

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await userEvent.click(within(items[0]!).getByRole("button", { name: "Copy public key" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(NEW_KEY.public_key));
  });

  it("offers Rotate key and no secret rotate or metadata edit", async () => {
    mount("repository", "/repositories");

    expect(await screen.findByRole("button", { name: "Rotate key" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Rotate secret" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit metadata" })).toBeNull();
  });

  it("gates the ssh actions on the platform when the engine answers an older ssh entry", async () => {
    vi.mocked(credentialsApi.listCredentialPlatforms).mockResolvedValue({
      items: [apiKey("ssh", ["host", "hostname", "identity_file"], true)],
    });
    mount("repository", "/repositories");

    expect(await screen.findByRole("button", { name: "Rotate key" })).toBeTruthy();
    await waitFor(() => expect(credentialsApi.listCredentialPlatforms).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Rotate secret" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit metadata" })).toBeNull();
  });

  it("states the GitHub step in the revoke confirmation of an older revision", async () => {
    mount("repository", "/repositories");

    await userEvent.click(await screen.findByRole("button", { name: "Revoke revision 1" }));
    const dialog = await screen.findByRole("alertdialog");

    expect(
      within(dialog).getByText(
        textContent(
          /After the revoke, delete the deploy key of revision 1 at GitHub\. Its fingerprint is SHA256:old/,
        ),
      ),
    ).toBeTruthy();
  });

  it("shows the alias metadata of a legacy revision as it is", async () => {
    vi.mocked(credentialsApi.readCredential).mockResolvedValue({
      ...SSH,
      revisions: [
        {
          id: "credential_01J9ZQ4XKM3B6V8N2R5T7W0YB3",
          revision: 1,
          metadata: { host: "github.com", identity_file: "~/.ssh/id_atlas" },
          created_at: 1,
          ended_at: null,
        },
      ],
    });
    mount("repository", "/repositories");

    const list = await screen.findByRole("list", { name: "Revisions" });
    expect(within(list).getByText("~/.ssh/id_atlas")).toBeTruthy();
    expect(within(list).queryByRole("button", { name: "Copy public key" })).toBeNull();
    expect(await screen.findByRole("button", { name: "Rotate key" })).toBeTruthy();
  });
});
