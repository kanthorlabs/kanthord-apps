import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as credentialsApi from "@/api/resources/credentials";
import * as workersApi from "@/api/resources/workers";
import type { AgentDeclaration, AgentEnablement, Credential } from "@/api/types";

vi.mock("@/api/resources/workers");
vi.mock("@/api/resources/credentials");

import { AgentScreen } from "./agent-screen";

const RE: AgentDeclaration = {
  agentName: "re@1",
  configurationSchema: { type: "object" },
  overridableFields: ["agentProvider", "modelIdentifier", "reasoningEffort"],
  enablement: null,
  prompt: {
    layers: [
      {
        layer: "system",
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
    { name: "read", source: "builtin", inputSchema: {} },
    { name: "grep", source: "builtin", inputSchema: {} },
  ],
};

const ENABLEMENT: AgentEnablement = {
  agentName: "re@1",
  state: "enabled",
  agentProviders: [{ name: "router", provider: "openrouter", credential: "router-main" }],
  defaultConfiguration: {
    agentProvider: "router",
    modelIdentifier: "qwen/qwen3-coder",
    reasoningEffort: "off",
  },
  revision: 2,
};

const ROUTER_MAIN: Credential = { name: "router-main", platform: "openrouter", revisions: [] };

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

    const system = within(await screen.findByRole("list", { name: "System layer" }));
    expect(system.getByText("~/.claude/CLAUDE.md")).toBeTruthy();
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

    await userEvent.click(screen.getByRole("button", { name: "Text of shipped" }));
    expect(await screen.findByText("re@1", { selector: "code" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Text of base" }));
    expect(await screen.findByText("You are a senior software engineer.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Text of Final prompt" }));
    expect(await screen.findByText("Framing of the final prompt.")).toBeTruthy();
    expect(screen.getByText("The final reviewer text.")).toBeTruthy();
  });

  it("lists every agent provider of the enablement with its credential", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValue({
      ...RE,
      enablement: {
        agentName: "re@1",
        state: "enabled",
        agentProviders: [
          { name: "router", provider: "openrouter", credential: "router-main" },
          { name: "codex", provider: "openai-codex", credential: "codex-main" },
        ],
        defaultConfiguration: {
          agentProvider: "router",
          modelIdentifier: "qwen/qwen3-coder",
          reasoningEffort: "off",
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
      { modelIdentifier: "anthropic/claude", reasoningEfforts: ["high"] },
      { modelIdentifier: "qwen/qwen3-coder", reasoningEfforts: ["off", "high"] },
    ]);
    mount();

    const form = await screen.findByRole("form", { name: "Enable re@1" });
    await userEvent.type(within(form).getByLabelText("Agent provider name"), "router");
    expect(within(form).queryByRole("combobox", { name: "Provider" })).toBeNull();
    await choose("Credential", "router-main (openrouter)");
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
      agentProviders: [{ name: "router", provider: "openrouter", credential: "router-main" }],
      defaultConfiguration: {
        agentProvider: "router",
        modelIdentifier: "qwen/qwen3-coder",
        reasoningEffort: "off",
      },
    });
    expect(workersApi.readAgent).toHaveBeenCalledTimes(2);
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
      agentProviders: [
        ...ENABLEMENT.agentProviders,
        { name: "codex", provider: "openai-codex", credential: "codex-main" },
      ],
      revision: 3,
    });
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Add agent provider" }));
    const sheet = await screen.findByRole("dialog");
    expect(
      within(sheet).getByText("Fill Name and Credential to add the agent provider."),
    ).toBeTruthy();
    await userEvent.type(within(sheet).getByRole("textbox", { name: "Name" }), "codex");
    await choose("Credential", "codex-main (openai-codex)");
    expect(within(sheet).getByText("Provider: openai-codex")).toBeTruthy();
    await userEvent.click(within(sheet).getByRole("button", { name: "Add agent provider" }));

    expect(workersApi.addAgentProvider).toHaveBeenCalledWith("re@1", {
      expectedRevision: 2,
      name: "codex",
      provider: "openai-codex",
      credential: "codex-main",
    });
  });
  it("removes an agent provider after the human confirms and keeps the default one", async () => {
    const two: AgentEnablement = {
      ...ENABLEMENT,
      agentProviders: [
        ...ENABLEMENT.agentProviders,
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

    expect(await within(sheet).findByText("No credential is left.")).toBeTruthy();
    expect(within(sheet).queryByRole("combobox", { name: "Credential" })).toBeNull();
    expect(within(sheet).queryByRole("button", { name: "Add agent provider" })).toBeNull();
    expect(within(sheet).getAllByRole("button", { name: "Add a credential" })).toHaveLength(1);
  });
  it("saves a new default configuration and keeps the agent providers", async () => {
    const two: AgentEnablement = {
      ...ENABLEMENT,
      agentProviders: [
        ...ENABLEMENT.agentProviders,
        { name: "codex", provider: "openai-codex", credential: "codex-main" },
      ],
    };
    vi.mocked(workersApi.readAgent).mockResolvedValue({ ...RE, enablement: two });
    vi.mocked(workersApi.listAgentProviderModels).mockImplementation(async (_agent, provider) =>
      provider === "codex"
        ? [{ modelIdentifier: "gpt-5-codex", reasoningEfforts: ["low", "high"] }]
        : [{ modelIdentifier: "qwen/qwen3-coder", reasoningEfforts: ["off"] }],
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
      expectedRevision: 2,
      agentProviders: two.agentProviders,
      defaultConfiguration: {
        agentProvider: "codex",
        modelIdentifier: "gpt-5-codex",
        reasoningEffort: "low",
      },
    });
  });
});
