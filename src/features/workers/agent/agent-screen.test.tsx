import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as credentialsApi from "@/api/resources/credentials";
import * as promptsApi from "@/api/resources/prompts";
import * as workersApi from "@/api/resources/workers";
import type {
  AgentDeclaration,
  AgentEnablement,
  Credential,
  PromptSettings,
  PromptTarget,
} from "@/api/types";

vi.mock("@/api/resources/workers");
vi.mock("@/api/resources/credentials");
vi.mock("@/api/resources/prompts");

import { AgentScreen } from "./agent-screen";

const RE: AgentDeclaration = {
  agent_name: "re@1",
  configuration_schema: { type: "object" },
  overridable_fields: ["agent_provider", "model_identifier", "reasoning_effort"],
  enablement: null,
  prompt: {
    layers: [
      {
        layer: "system",
        enabled: true,
        sources: [
          {
            source: "host_file",
            origin: "file",
            path: "~/.claude/CLAUDE.md",
            enabled: false,
            state: "off",
            digest: null,
            text: null,
          },
          {
            source: "base",
            origin: "binary",
            path: null,
            enabled: true,
            state: "present",
            digest: "a".repeat(64),
            text: "You are a senior software engineer.",
          },
        ],
      },
      {
        layer: "agent",
        enabled: true,
        sources: [
          {
            source: "shipped",
            origin: "binary",
            path: null,
            enabled: true,
            state: "present",
            digest: "b".repeat(64),
            text: "Your role is `re@1`, the reviewer.",
          },
        ],
      },
    ],
    final:
      "Framing of the final prompt.\n\nInstructions of file AGENTS.md:\n\nThe final reviewer text.",
  },
  tools: [
    { name: "read", source: "builtin", input_schema: {} },
    { name: "grep", source: "builtin", input_schema: {} },
  ],
};

const ENABLEMENT: AgentEnablement = {
  agent_name: "re@1",
  state: "enabled",
  agent_providers: [{ name: "router", provider: "openrouter", credential: "router-main" }],
  default_configuration: {
    agent_provider: "router",
    model_identifier: "qwen/qwen3-coder",
    reasoning_effort: "off",
  },
  revision: 2,
};

const ROUTER_MAIN: Credential = { name: "router-main", platform: "openrouter", revisions: [] };

const SWITCHES: Readonly<Record<string, Readonly<Record<string, boolean>>>> = {
  system: { host_file: false, base: true, custom: true, layer: false },
  agent: { agent_file: false, shipped: true, custom: false },
  workbench: { agents_md: true, shipped: true, custom: true },
};

function settingsOf(target: PromptTarget): PromptSettings {
  return {
    scope: target.scope,
    agent_name: target.agent_name ?? "",
    switches: SWITCHES[target.scope] ?? {},
    locked_switches: [],
    custom_text: "",
    system_layer: target.scope === "agent" ? "inherit" : null,
    revision: 3,
  };
}

async function choose(label: string, option: string) {
  await userEvent.click(screen.getByRole("combobox", { name: label }));
  await userEvent.click(await screen.findByRole("option", { name: option }));
}

function mount() {
  return render(
    <MemoryRouter initialEntries={["/agents/re%401"]}>
      <Routes>
        <Route path="/agents/:agentName" element={<AgentScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AgentScreen", () => {
  beforeEach(() => {
    vi.mocked(credentialsApi.listAllCredentials).mockResolvedValue([]);
    vi.mocked(promptsApi.readPromptSettings).mockImplementation((target) =>
      Promise.resolve(settingsOf(target)),
    );
  });

  it("reads the agent named in the path", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValue(RE);
    mount();

    expect(await screen.findByRole("heading", { name: "re@1" })).toBeTruthy();
    expect(workersApi.readAgent).toHaveBeenCalledWith("re@1");
  });

  it("links the agent to its workbench", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValue(RE);
    mount();

    expect(await screen.findByRole("button", { name: "Workbench" })).toHaveAttribute(
      "href",
      "/workbench?agentName=re%401",
    );
  });

  it("shows the prompts, the tools and the absent enablement", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValue(RE);
    mount();

    await userEvent.click(await screen.findByRole("switch", { name: "Show inactive sources" }));
    const system = within(await screen.findByRole("list", { name: "System layer" }));
    expect(await system.findByText("~/.claude/CLAUDE.md")).toBeTruthy();
    expect(system.getByText("off")).toBeTruthy();
    expect(screen.getByText("not enabled")).toBeTruthy();
    expect(screen.getByText(/No enablement exists/)).toBeTruthy();
    const tools = within(screen.getByRole("list", { name: "Tools" })).getAllByRole("listitem");
    expect(tools.map((t) => t.textContent)).toEqual(["readbuiltin", "grepbuiltin"]);
  });

  it("collapses every prompt text and renders it as markdown on open", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValue(RE);
    mount();

    await screen.findByRole("list", { name: "Agent layer" });
    expect(screen.queryByText(/the reviewer/)).toBeNull();
    expect(screen.queryByText("Framing of the final prompt.")).toBeNull();

    const shipped = screen.getByRole("button", { name: "Shipped agent prompt" });
    expect(shipped).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(shipped);
    expect(shipped).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByText("re@1", { selector: "code" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Shipped base prompt" }));
    expect(await screen.findByText("You are a senior software engineer.")).toBeTruthy();
    await userEvent.click(
      screen.getByRole("button", { name: "System prompt and working messages" }),
    );
    expect(await screen.findByText("Framing of the final prompt.")).toBeTruthy();
    expect(screen.getByText("The final reviewer text.")).toBeTruthy();
  });

  it("shows a source without text as an inactive row with no toggle and no copy", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValue(RE);
    mount();

    await userEvent.click(await screen.findByRole("switch", { name: "Show inactive sources" }));
    const system = within(await screen.findByRole("list", { name: "System layer" }));
    expect(await system.findByText("~/.claude/CLAUDE.md")).toBeTruthy();
    expect(system.queryByRole("button", { name: "~/.claude/CLAUDE.md" })).toBeNull();
    expect(
      system.queryByRole("button", { name: "Copy markdown of ~/.claude/CLAUDE.md" }),
    ).toBeNull();
  });

  it("copies the raw markdown of a source", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValue(RE);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    mount();

    await userEvent.click(
      await screen.findByRole("button", { name: "Copy markdown of Shipped agent prompt" }),
    );

    expect(writeText).toHaveBeenCalledWith("Your role is `re@1`, the reviewer.");
  });

  it("sets the system layer override of the agent at its revision", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValue(RE);
    vi.mocked(promptsApi.setSystemLayerOverride).mockResolvedValue({
      ...settingsOf({ scope: "agent", agent_name: "re@1" }),
      system_layer: "on",
    });
    mount();

    const control = await screen.findByRole("group", { name: "System layer of re@1" });
    await waitFor(() =>
      expect(screen.getByText(/Follows the server switch, which is off\./)).toBeTruthy(),
    );
    await userEvent.click(within(control).getByRole("button", { name: "On" }));

    expect(promptsApi.setSystemLayerOverride).toHaveBeenCalledWith("re@1", 3, "on");
  });

  it("switches an agent layer source and locks the last source that is on", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValue(RE);
    vi.mocked(promptsApi.switchPromptSource).mockResolvedValue(
      settingsOf({ scope: "agent", agent_name: "re@1" }),
    );
    mount();

    const shipped = await screen.findByRole("switch", { name: "Shipped agent prompt switch" });
    await waitFor(() => expect(shipped).toHaveAttribute("aria-disabled", "true"));
    expect(screen.queryByRole("switch", { name: "Shipped base prompt switch" })).toBeNull();
  });

  it("hides an inactive source until the human shows it", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValue(RE);
    mount();

    const show = await screen.findByRole("switch", { name: "Show inactive sources" });
    expect(show).not.toBeChecked();
    expect(screen.queryByText("~/.claude/CLAUDE.md")).toBeNull();
    expect(screen.getByText("Shipped base prompt")).toBeTruthy();

    await userEvent.click(show);

    expect(await screen.findByText("~/.claude/CLAUDE.md")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "1 inactive source hidden" })).toBeNull();

    await userEvent.click(show);

    await waitFor(() => expect(screen.queryByText("~/.claude/CLAUDE.md")).toBeNull());
  });

  it("shows only the hidden sources of its own layer from a footer", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValue({
      ...RE,
      prompt: {
        ...RE.prompt,
        layers: [
          ...(RE.prompt.layers ?? []),
          {
            layer: "working",
            enabled: true,
            sources: [
              {
                source: "agents_md",
                origin: "file",
                path: "~/workbench/AGENTS.md",
                enabled: true,
                state: "absent",
                digest: null,
                text: null,
              },
            ],
          },
        ],
      },
    });
    mount();

    const [systemFooter] = await screen.findAllByRole("button", {
      name: "1 inactive source hidden",
    });
    await userEvent.click(systemFooter!);

    expect(await screen.findByText("~/.claude/CLAUDE.md")).toBeTruthy();
    expect(screen.queryByText("~/workbench/AGENTS.md")).toBeNull();
    expect(screen.getAllByRole("button", { name: "1 inactive source hidden" })).toHaveLength(1);
    expect(screen.getByRole("switch", { name: "Show inactive sources" })).not.toBeChecked();
  });

  it("keeps the preference of the viewer", async () => {
    window.localStorage.setItem("kanthord.agent.show-inactive-sources", "true");
    vi.mocked(workersApi.readAgent).mockResolvedValue(RE);
    mount();

    expect(await screen.findByRole("switch", { name: "Show inactive sources" })).toBeChecked();
    expect(screen.getByText("~/.claude/CLAUDE.md")).toBeTruthy();
  });

  it("keeps a row that the human turns off until the next page load", async () => {
    const shippedOff = {
      ...RE,
      prompt: {
        ...RE.prompt,
        layers: (RE.prompt.layers ?? []).map((layer) =>
          layer.layer === "agent"
            ? {
                ...layer,
                sources: layer.sources.map((source) => ({
                  ...source,
                  enabled: false,
                  state: "off" as const,
                  text: null,
                })),
              }
            : layer,
        ),
      },
    };
    vi.mocked(workersApi.readAgent).mockResolvedValueOnce(RE).mockResolvedValue(shippedOff);
    vi.mocked(promptsApi.readPromptSettings).mockImplementation((target) =>
      Promise.resolve({
        ...settingsOf(target),
        switches: { agent_file: true, shipped: true, custom: true },
      }),
    );
    vi.mocked(promptsApi.switchPromptSource).mockResolvedValue(
      settingsOf({ scope: "agent", agent_name: "re@1" }),
    );
    mount();

    const shipped = await screen.findByRole("switch", { name: "Shipped agent prompt switch" });
    await waitFor(() => expect(shipped).not.toHaveAttribute("aria-disabled", "true"));
    await userEvent.click(shipped);

    const agentLayer = within(screen.getByRole("list", { name: "Agent layer" }));
    expect(await agentLayer.findByText("off")).toBeTruthy();
    expect(agentLayer.getByText("Shipped agent prompt")).toBeTruthy();
  });

  it("disables the switch of a file source that does not exist", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValue({
      ...RE,
      prompt: {
        ...RE.prompt,
        layers: [
          ...(RE.prompt.layers ?? []),
          {
            layer: "working",
            enabled: true,
            sources: [
              {
                source: "agents_md",
                origin: "file",
                path: "~/workbench/AGENTS.md",
                enabled: true,
                state: "absent",
                digest: null,
                text: null,
              },
            ],
          },
        ],
      },
    });
    mount();

    await userEvent.click(await screen.findByRole("switch", { name: "Show inactive sources" }));
    const missing = await screen.findByRole("switch", { name: "~/workbench/AGENTS.md switch" });
    await waitFor(() => expect(missing).toHaveAttribute("aria-disabled", "true"));
    expect(screen.getByText("~/workbench/AGENTS.md does not exist.")).toBeTruthy();
  });

  it("turns an agent layer source off at the revision of its scope", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValue(RE);
    vi.mocked(promptsApi.readPromptSettings).mockImplementation((target) =>
      Promise.resolve({
        ...settingsOf(target),
        switches: { agent_file: true, shipped: true, custom: true },
      }),
    );
    vi.mocked(promptsApi.switchPromptSource).mockResolvedValue(
      settingsOf({ scope: "agent", agent_name: "re@1" }),
    );
    mount();

    const shipped = await screen.findByRole("switch", { name: "Shipped agent prompt switch" });
    await waitFor(() => expect(shipped).not.toHaveAttribute("aria-disabled", "true"));
    await userEvent.click(shipped);

    expect(promptsApi.switchPromptSource).toHaveBeenCalledWith(
      { scope: "agent", agent_name: "re@1" },
      3,
      "shipped",
      false,
    );
  });

  it("lists every agent provider of the enablement with its credential", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValue({
      ...RE,
      enablement: {
        agent_name: "re@1",
        state: "enabled",
        agent_providers: [
          { name: "router", provider: "openrouter", credential: "router-main" },
          { name: "codex", provider: "openai-codex", credential: "codex-main" },
        ],
        default_configuration: {
          agent_provider: "router",
          model_identifier: "qwen/qwen3-coder",
          reasoning_effort: "off",
        },
        revision: 2,
      },
    });
    mount();

    const providers = within(
      await screen.findByRole("list", { name: "Agent providers" }),
    ).getAllByRole("listitem");
    expect(providers.map((p) => p.textContent)).toEqual([
      "routeropenrouter · credential router-mainRemove",
      "codexopenai-codex · credential codex-mainRemove",
    ]);
  });

  it("creates the enablement with one agent provider and the default configuration", async () => {
    vi.mocked(workersApi.readAgent).mockClear().mockResolvedValue(RE);
    vi.mocked(credentialsApi.listAllCredentials).mockResolvedValue([ROUTER_MAIN]);
    vi.mocked(workersApi.putAgentEnablement).mockResolvedValue({ ...ENABLEMENT, revision: 1 });
    vi.mocked(workersApi.listCredentialModels).mockResolvedValue([
      { model_identifier: "anthropic/claude", reasoning_efforts: ["high"] },
      { model_identifier: "qwen/qwen3-coder", reasoning_efforts: ["off", "high"] },
    ]);
    mount();

    const form = await screen.findByRole("form", { name: "Enable re@1" });
    await userEvent.type(within(form).getByLabelText("Agent provider name"), "router");
    expect(within(form).queryByRole("combobox", { name: "Provider" })).toBeNull();
    await choose("LLM credential", "router-main (openrouter)");
    expect(workersApi.listCredentialModels).toHaveBeenCalledWith("openrouter", "router-main");
    expect(within(form).queryByText(/Provider:/)).toBeNull();
    await waitFor(() =>
      expect(within(form).getByRole("combobox", { name: "Model identifier" })).toHaveValue(
        "anthropic/claude",
      ),
    );
    await choose("Model identifier", "qwen/qwen3-coder");
    await choose("Reasoning effort", "off");
    await userEvent.click(within(form).getByRole("button", { name: "Enable agent" }));

    expect(workersApi.putAgentEnablement).toHaveBeenCalledWith("re@1", {
      agent_providers: [{ name: "router", provider: "openrouter", credential: "router-main" }],
      default_configuration: {
        agent_provider: "router",
        model_identifier: "qwen/qwen3-coder",
        reasoning_effort: "off",
      },
    });
    expect(workersApi.readAgent).toHaveBeenCalledTimes(2);
  });

  it("shows a model list failure on the model field and keeps the form grid", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValue(RE);
    vi.mocked(credentialsApi.listAllCredentials).mockResolvedValue([ROUTER_MAIN]);
    vi.mocked(workersApi.listCredentialModels).mockRejectedValue(
      new ApiError("refused", "Request validation failed.", 400),
    );
    mount();

    const form = await screen.findByRole("form", { name: "Enable re@1" });
    const cells = () => [...(form.firstElementChild?.children ?? [])];
    const before = cells().length;
    await choose("LLM credential", "router-main (openrouter)");
    const model = within(form)
      .getByRole("combobox", { name: "Model identifier" })
      .closest("[data-slot='field']");
    await waitFor(() => expect(model?.textContent).toContain("Request validation failed."));
    expect(cells().length).toBe(before);
  });

  it("refuses a create without a credential and a reasoning effort", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValue(RE);
    vi.mocked(workersApi.putAgentEnablement).mockClear();
    mount();

    const form = await screen.findByRole("form", { name: "Enable re@1" });
    await userEvent.click(within(form).getByRole("button", { name: "Enable agent" }));

    expect(workersApi.putAgentEnablement).not.toHaveBeenCalled();
    expect(within(form).getAllByText("Choose a value.").length).toBeGreaterThan(0);
  });

  it("disables an enabled agent at its revision", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValue({ ...RE, enablement: ENABLEMENT });
    vi.mocked(workersApi.disableAgentEnablement).mockResolvedValue({
      ...ENABLEMENT,
      state: "disabled",
      revision: 3,
    });
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Disable" }));

    expect(workersApi.disableAgentEnablement).toHaveBeenCalledWith("re@1", 2);
    expect(screen.queryByRole("form", { name: "Enable re@1" })).toBeNull();
  });

  it("enables a disabled agent at its revision", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValue({
      ...RE,
      enablement: { ...ENABLEMENT, state: "disabled", revision: 3 },
    });
    vi.mocked(workersApi.enableAgentEnablement).mockResolvedValue({ ...ENABLEMENT, revision: 4 });
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Enable" }));

    expect(workersApi.enableAgentEnablement).toHaveBeenCalledWith("re@1", 3);
  });
  it("adds an agent provider from a credential and derives its provider", async () => {
    const codex: Credential = { name: "codex-main", platform: "openai-codex", revisions: [] };
    vi.mocked(workersApi.readAgent).mockResolvedValue({ ...RE, enablement: ENABLEMENT });
    vi.mocked(credentialsApi.listAllCredentials).mockResolvedValue([ROUTER_MAIN, codex]);
    vi.mocked(workersApi.addAgentProvider).mockResolvedValue({
      ...ENABLEMENT,
      agent_providers: [
        ...ENABLEMENT.agent_providers,
        { name: "codex", provider: "openai-codex", credential: "codex-main" },
      ],
      revision: 3,
    });
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Add agent provider" }));
    const sheet = await screen.findByRole("dialog");
    expect(
      within(sheet).getByText("Fill Name and LLM credential to add the agent provider."),
    ).toBeTruthy();
    await userEvent.type(within(sheet).getByRole("textbox", { name: "Name" }), "codex");
    await choose("LLM credential", "codex-main (openai-codex)");
    expect(within(sheet).getByText("Provider: openai-codex")).toBeTruthy();
    await userEvent.click(within(sheet).getByRole("button", { name: "Add agent provider" }));

    expect(workersApi.addAgentProvider).toHaveBeenCalledWith("re@1", {
      expected_revision: 2,
      name: "codex",
      provider: "openai-codex",
      credential: "codex-main",
    });
  });
  it("removes an agent provider after the human confirms and keeps the default one", async () => {
    const two: AgentEnablement = {
      ...ENABLEMENT,
      agent_providers: [
        ...ENABLEMENT.agent_providers,
        { name: "codex", provider: "openai-codex", credential: "codex-main" },
      ],
    };
    vi.mocked(workersApi.readAgent).mockResolvedValue({ ...RE, enablement: two });
    vi.mocked(workersApi.removeAgentProvider).mockResolvedValue({ ...ENABLEMENT, revision: 3 });
    mount();

    expect(await screen.findByRole("button", { name: "Remove router" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await userEvent.click(screen.getByRole("button", { name: "Remove codex" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/Add another agent provider instead/)).toBeTruthy();
    await userEvent.click(within(dialog).getByRole("button", { name: "Remove codex" }));

    expect(workersApi.removeAgentProvider).toHaveBeenCalledWith("re@1", "codex", 2);
  });
  it("shows only the empty state with one action when no credential is left", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValue({ ...RE, enablement: ENABLEMENT });
    vi.mocked(credentialsApi.listAllCredentials).mockResolvedValue([ROUTER_MAIN]);
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Add agent provider" }));
    const sheet = await screen.findByRole("dialog");

    expect(await within(sheet).findByText("No LLM credential is left.")).toBeTruthy();
    expect(within(sheet).queryByRole("combobox", { name: "LLM credential" })).toBeNull();
    expect(within(sheet).queryByRole("button", { name: "Add agent provider" })).toBeNull();
    expect(within(sheet).getAllByRole("button", { name: "Add an LLM credential" })).toHaveLength(1);
  });
  it("saves a new default configuration and keeps the agent providers", async () => {
    const two: AgentEnablement = {
      ...ENABLEMENT,
      agent_providers: [
        ...ENABLEMENT.agent_providers,
        { name: "codex", provider: "openai-codex", credential: "codex-main" },
      ],
    };
    vi.mocked(workersApi.readAgent).mockResolvedValue({ ...RE, enablement: two });
    vi.mocked(workersApi.listAgentProviderModels).mockImplementation(async (_agent, provider) =>
      provider === "codex"
        ? [{ model_identifier: "gpt-5-codex", reasoning_efforts: ["low", "high"] }]
        : [{ model_identifier: "qwen/qwen3-coder", reasoning_efforts: ["off"] }],
    );
    vi.mocked(workersApi.putAgentEnablement).mockResolvedValue({ ...two, revision: 3 });
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Edit default" }));
    const sheet = await screen.findByRole("dialog");
    await choose("Agent Provider", "codex");
    await waitFor(() =>
      expect(within(sheet).getByRole("combobox", { name: "Model Identifier" })).toHaveValue(
        "gpt-5-codex",
      ),
    );
    await userEvent.click(within(sheet).getByRole("button", { name: "Save default" }));

    expect(workersApi.putAgentEnablement).toHaveBeenCalledWith("re@1", {
      expected_revision: 2,
      agent_providers: two.agent_providers,
      default_configuration: {
        agent_provider: "codex",
        model_identifier: "gpt-5-codex",
        reasoning_effort: "low",
      },
    });
  });
});
