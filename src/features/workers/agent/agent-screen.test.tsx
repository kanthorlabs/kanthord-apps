import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

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
  basePrompt: "You are a senior software engineer.",
  agentPrompt: "Your role is `re@1`, the reviewer.",
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

    expect(await screen.findByText("Your role is `re@1`, the reviewer.")).toBeTruthy();
    expect(screen.getByText("You are a senior software engineer.")).toBeTruthy();
    expect(screen.getByText("not enabled")).toBeTruthy();
    expect(screen.getByText(/No enablement exists/)).toBeTruthy();
    const tools = within(screen.getByRole("list", { name: "Tools" })).getAllByRole("listitem");
    expect(tools.map((t) => t.textContent)).toEqual(["readbuiltin", "grepbuiltin"]);
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
      "routeropenrouter · credential router-main",
      "codexopenai-codex · credential codex-main",
    ]);
  });

  it("creates the enablement with one agent provider and the default configuration", async () => {
    vi.mocked(workersApi.readAgent).mockClear().mockResolvedValue(RE);
    vi.mocked(credentialsApi.listCredentials).mockResolvedValue([ROUTER_MAIN]);
    vi.mocked(workersApi.putAgentEnablement).mockResolvedValue({ ...ENABLEMENT, revision: 1 });
    mount();

    const form = await screen.findByRole("form", { name: "Enable re@1" });
    await userEvent.type(within(form).getByLabelText("Agent provider name"), "router");
    await choose("Provider", "openrouter");
    expect(credentialsApi.listCredentials).toHaveBeenCalledWith("llm", "openrouter");
    await choose("Credential", "router-main");
    await userEvent.type(within(form).getByLabelText("Model identifier"), "qwen/qwen3-coder");
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

  it("refuses a create without a provider and a reasoning effort", async () => {
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
});
