import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as credentialsApi from "@/api/resources/credentials";
import * as workersApi from "@/api/resources/workers";
import type {
  AgentChainEntry,
  AgentDeclaration,
  AgentEnablement,
  Credential,
  HealthEntry,
} from "@/api/types";

vi.mock("@/api/resources/workers");
vi.mock("@/api/resources/credentials");

import { AgentScreen } from "./agent-screen";
import { textContent } from "../../../../test/text-content";

const RE: AgentDeclaration = {
  agent_name: "re@1",
  configuration_schema: { type: "object" },
  overridable_fields: ["agent_provider", "model_identifier", "reasoning_effort"],
  enablement: null,
  prompt: {
    parts: [
      {
        part: "standard",
        name: "base.md",
        origin: "binary",
        path: "/data/agents/base.md",
        digest: "a".repeat(64),
        text: "This text is the shared standard of every agent.",
      },
      {
        part: "role",
        name: "re@1.md",
        origin: "file",
        path: "/data/agents/re@1.md",
        digest: "b".repeat(64),
        text: "Your role is `re@1`, the reviewer.",
      },
    ],
    final:
      "Framing of the final prompt.\n\nInstructions of repository kanthord:\n\nThe final reviewer text.",
  },
  tools: [
    { name: "read", source: "builtin", input_schema: {} },
    { name: "grep", source: "builtin", input_schema: {} },
  ],
  chain: [],
  active_position: null,
  cooling: null,
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
  fallback_configurations: [],
  revision: 2,
};

const LIVE_END = Date.UTC(2099, 0, 1);
const EXPIRED_END = Date.UTC(2020, 0, 1);

const HEAD_ENTRY: AgentChainEntry = {
  position: 0,
  level: "enablement",
  agent_provider: "router",
  provider: "openrouter",
  credential: "router-main",
  model_identifier: "qwen/qwen3-coder",
  reasoning_effort: "off",
  cooldown: null,
};

const SPARE_ENTRY: AgentChainEntry = {
  ...HEAD_ENTRY,
  position: 1,
  agent_provider: "spare",
  credential: "spare-main",
  model_identifier: "qwen/qwen3-max",
};

const ROUTER_MAIN: Credential = {
  name: "router-main",
  platform: "openrouter",
  holder: "server",
  sealed_to: null,
  sealed_current: true,
  revisions: [],
};

async function choose(label: string, option: string) {
  await userEvent.click(screen.getByRole("combobox", { name: label }));
  await userEvent.click(await screen.findByRole("option", { name: option }));
}

function mount(hash = "", state: unknown = null) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/agents/re%401", hash, state }]}>
      <Routes>
        <Route path="/" element={<p>Onboarding view</p>} />
        <Route path="/agents/:agentName" element={<AgentScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AgentScreen", () => {
  beforeEach(() => {
    vi.mocked(credentialsApi.listAllCredentials).mockResolvedValue([]);
    vi.mocked(credentialsApi.readCredential).mockImplementation((_component, name) =>
      Promise.resolve({ ...ROUTER_MAIN, name, agent_providers: [] }),
    );
    vi.mocked(credentialsApi.listCredentialPlatforms).mockResolvedValue({ items: [] });
    vi.mocked(credentialsApi.verifyCredential).mockResolvedValue({
      status: "healthy",
      capability: "model-list read",
      failure_reason: null,
    });
    vi.mocked(workersApi.listAgentEnablements).mockResolvedValue([]);
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

  it("links the agent to its traces", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValue(RE);
    mount();

    expect(await screen.findByRole("button", { name: "Traces" })).toHaveAttribute(
      "href",
      "/traces?agent_name=re%401",
    );
  });

  it("shows the tools and the absent enablement", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValue(RE);
    mount();

    expect(await screen.findByText("not enabled")).toBeTruthy();
    expect(screen.getByText(/No enablement exists/)).toBeTruthy();
    const tools = within(screen.getByRole("list", { name: "Tools" })).getAllByRole("listitem");
    expect(tools.map((t) => t.textContent)).toEqual(["readbuiltin", "grepbuiltin"]);
  });

  it("shows the fallback chain with no cooldown and marks the head active", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValue({
      ...RE,
      enablement: ENABLEMENT,
      chain: [HEAD_ENTRY, SPARE_ENTRY],
      active_position: 0,
      cooling: null,
    });
    mount();

    const chain = within(await screen.findByRole("list", { name: "Fallback chain" }));
    const [head, spare] = chain.getAllByRole("listitem");
    expect(head?.textContent).toContain("#0qwen/qwen3-coderenablementactive");
    expect(head?.textContent).toContain("credential router-main");
    expect(head?.textContent).toContain("No cooldown.");
    expect(spare?.textContent).not.toContain("active");
    expect(screen.queryByText("The chain of this agent cools down.")).toBeNull();
  });

  it("shows one cooling entry and keeps the next entry active", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValue({
      ...RE,
      enablement: ENABLEMENT,
      chain: [{ ...HEAD_ENTRY, cooldown: { strikes: 2, available_at: LIVE_END } }, SPARE_ENTRY],
      active_position: 1,
      cooling: null,
    });
    mount();

    const chain = within(await screen.findByRole("list", { name: "Fallback chain" }));
    const [head, spare] = chain.getAllByRole("listitem");
    expect(head?.textContent).toContain(
      "Strike 2. Claims skip this credential until 2099-01-01 00:00 UTC.",
    );
    expect(head?.textContent).not.toContain("active");
    expect(spare?.textContent).toContain("active");
    expect(screen.queryByText("The chain of this agent cools down.")).toBeNull();
  });

  it("shows an expired cooldown as no live cooldown", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValue({
      ...RE,
      enablement: ENABLEMENT,
      chain: [
        { ...HEAD_ENTRY, cooldown: { strikes: 1, available_at: LIVE_END } },
        { ...SPARE_ENTRY, cooldown: { strikes: 3, available_at: EXPIRED_END } },
      ],
      active_position: 1,
      cooling: null,
    });
    mount();

    const expired = within(await screen.findByRole("list", { name: "Fallback chain" }));
    expect(expired.getAllByRole("listitem")[1]?.textContent).toContain(
      "No live cooldown. Strike 3 ended at 2020-01-01 00:00 UTC.",
    );
  });

  it("shows the cooling notice and no active entry when every entry cools down", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValue({
      ...RE,
      enablement: ENABLEMENT,
      chain: [
        { ...HEAD_ENTRY, cooldown: { strikes: 1, available_at: LIVE_END } },
        { ...SPARE_ENTRY, cooldown: { strikes: 1, available_at: LIVE_END } },
      ],
      active_position: null,
      cooling: { code: "agent.configuration.chain_cooling", available_at: LIVE_END },
    });
    mount();

    expect(await screen.findByText("The chain of this agent cools down.")).toBeTruthy();
    expect(
      screen.getByText(/Every credential of the chain cools down until 2099-01-01 00:00 UTC\./),
    ).toBeTruthy();
    const chain = within(screen.getByRole("list", { name: "Fallback chain" }));
    expect(
      chain
        .getAllByRole("listitem")
        .map((item) => item.textContent)
        .join(""),
    ).not.toContain("active");
  });

  it("shows no chain for an absent enablement", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValue(RE);
    mount();

    expect(
      await screen.findByText("No chain. The enablement is absent, disabled or invalid."),
    ).toBeTruthy();
  });

  it("lists each part of the Agent prompt with its origin and digest", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValue(RE);
    mount();

    const parts = within(await screen.findByRole("list", { name: "Agent prompt" }));
    expect(parts.getAllByRole("listitem")).toHaveLength(2);
    expect(parts.getByText("Shipped")).toBeTruthy();
    expect(parts.getByText("/data/agents/base.md")).toBeTruthy();
    expect(parts.getByText(/No override file at/)).toBeTruthy();
    expect(parts.getByText("Overridden")).toBeTruthy();
    expect(parts.getByText("/data/agents/re@1.md")).toBeTruthy();
    expect(parts.getByText(/Override file/)).toBeTruthy();
    expect(parts.getByText("standard")).toBeTruthy();
    expect(parts.getByText("role")).toBeTruthy();
    expect(parts.getByText("a".repeat(64))).toBeTruthy();
    expect(parts.getByText("b".repeat(64))).toBeTruthy();
  });

  it("titles the final prompt after the worker unless the Workbench part is present", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValueOnce(RE);
    const first = mount();
    expect(await screen.findByRole("heading", { name: "Worker final prompt" })).toBeTruthy();
    first.unmount();

    vi.mocked(workersApi.readAgent).mockResolvedValueOnce({
      ...RE,
      prompt: {
        ...RE.prompt,
        parts: [
          ...(RE.prompt.parts ?? []),
          {
            part: "workbench",
            name: "workbench.md",
            origin: "binary",
            path: null,
            digest: "c".repeat(64),
            text: "Work with a human.",
          },
        ],
      },
    });
    mount();
    expect(await screen.findByRole("heading", { name: "Workbench final prompt" })).toBeTruthy();
  });

  it("shows no switch and no editor for the Agent prompt", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValue(RE);
    mount();

    await screen.findByRole("list", { name: "Agent prompt" });
    expect(screen.queryByRole("switch", { name: /inactive sources/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Edit/ })).toBeNull();
  });

  it("collapses every prompt text and renders it as markdown on open", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValue(RE);
    mount();

    await screen.findByRole("list", { name: "Agent prompt" });
    expect(screen.queryByText(/the reviewer/)).toBeNull();
    expect(screen.queryByText("Framing of the final prompt.")).toBeNull();

    const role = screen.getByRole("button", { name: "re@1.md" });
    expect(role).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(role);
    expect(role).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByText("re@1", { selector: "code" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "base.md" }));
    expect(
      await screen.findByText("This text is the shared standard of every agent."),
    ).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "System prompt" }));
    expect(await screen.findByText("Framing of the final prompt.")).toBeTruthy();
    expect(screen.getByText("The final reviewer text.")).toBeTruthy();
  });

  it("copies the raw markdown of a part", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValue(RE);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Copy markdown of re@1.md" }));

    expect(writeText).toHaveBeenCalledWith("Your role is `re@1`, the reviewer.");
  });

  it("shows no Agent prompt card when the answer holds no parts", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValue({
      ...RE,
      prompt: { final: RE.prompt.final },
    });
    mount();

    await screen.findByRole("button", { name: "System prompt" });
    expect(screen.queryByRole("list", { name: "Agent prompt" })).toBeNull();
  });

  it("names the file and the reason when an override file is invalid", async () => {
    vi.mocked(workersApi.readAgent).mockRejectedValue(
      new ApiError(
        "conflict",
        "Prompt file re@1.md is invalid: control_character",
        409,
        "agent.prompt.template_invalid",
        { file: "re@1.md", path: "/data/agents/re@1.md", reason: "control_character" },
      ),
    );
    mount();

    expect(
      await screen.findByText(/The prompt file re@1\.md is invalid: it holds a control character/),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
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
        fallback_configurations: [],
        revision: 2,
      },
    });
    mount();

    const providers = within(
      await screen.findByRole("list", { name: "Agent providers" }),
    ).getAllByRole("listitem");
    expect(providers.map((p) => p.textContent)).toEqual([
      "routeropenrouter · credential router-mainVerifyRemove",
      "codexopenai-codex · credential codex-mainVerifyRemove",
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
      fallback_configurations: [],
    });
    expect(workersApi.readAgent).toHaveBeenCalledTimes(2);
  });

  it("returns to the path of the router state after the enablement create", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValue(RE);
    vi.mocked(credentialsApi.listAllCredentials).mockResolvedValue([ROUTER_MAIN]);
    vi.mocked(workersApi.putAgentEnablement).mockResolvedValue({ ...ENABLEMENT, revision: 1 });
    vi.mocked(workersApi.listCredentialModels).mockResolvedValue([
      { model_identifier: "qwen/qwen3-coder", reasoning_efforts: ["off"] },
    ]);
    mount("#enablement", { return_to: "/" });

    const form = await screen.findByRole("form", { name: "Enable re@1" });
    await userEvent.type(within(form).getByLabelText("Agent provider name"), "router");
    await choose("LLM credential", "router-main (openrouter)");
    await waitFor(() =>
      expect(within(form).getByRole("combobox", { name: "Model identifier" })).toHaveValue(
        "qwen/qwen3-coder",
      ),
    );
    await choose("Reasoning effort", "off");
    await userEvent.click(within(form).getByRole("button", { name: "Enable agent" }));

    expect(await screen.findByText("Onboarding view")).toBeTruthy();
  });

  it("stays on the agent after the enablement create without a return path", async () => {
    vi.mocked(workersApi.readAgent).mockClear().mockResolvedValue(RE);
    vi.mocked(credentialsApi.listAllCredentials).mockResolvedValue([ROUTER_MAIN]);
    vi.mocked(workersApi.putAgentEnablement)
      .mockClear()
      .mockResolvedValue({ ...ENABLEMENT, revision: 1 });
    vi.mocked(workersApi.listCredentialModels).mockResolvedValue([
      { model_identifier: "qwen/qwen3-coder", reasoning_efforts: ["off"] },
    ]);
    mount();

    const form = await screen.findByRole("form", { name: "Enable re@1" });
    await userEvent.type(within(form).getByLabelText("Agent provider name"), "router");
    await choose("LLM credential", "router-main (openrouter)");
    await waitFor(() =>
      expect(within(form).getByRole("combobox", { name: "Model identifier" })).toHaveValue(
        "qwen/qwen3-coder",
      ),
    );
    await choose("Reasoning effort", "off");
    await userEvent.click(within(form).getByRole("button", { name: "Enable agent" }));

    await waitFor(() => expect(workersApi.readAgent).toHaveBeenCalledTimes(2));
    expect(workersApi.putAgentEnablement).toHaveBeenCalledOnce();
    expect(screen.queryByText("Onboarding view")).toBeNull();
    expect(screen.getByRole("heading", { name: "re@1" })).toBeTruthy();
  });

  it("stays on the agent when the enablement create with a return path fails", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValue(RE);
    vi.mocked(credentialsApi.listAllCredentials).mockResolvedValue([ROUTER_MAIN]);
    vi.mocked(workersApi.putAgentEnablement).mockRejectedValue(
      new ApiError("conflict", "The enablement changed.", 409),
    );
    vi.mocked(workersApi.listCredentialModels).mockResolvedValue([
      { model_identifier: "qwen/qwen3-coder", reasoning_efforts: ["off"] },
    ]);
    mount("#enablement", { return_to: "/" });

    const form = await screen.findByRole("form", { name: "Enable re@1" });
    await userEvent.type(within(form).getByLabelText("Agent provider name"), "router");
    await choose("LLM credential", "router-main (openrouter)");
    await waitFor(() =>
      expect(within(form).getByRole("combobox", { name: "Model identifier" })).toHaveValue(
        "qwen/qwen3-coder",
      ),
    );
    await choose("Reasoning effort", "off");
    await userEvent.click(within(form).getByRole("button", { name: "Enable agent" }));

    expect(await screen.findByText("The enablement changed.")).toBeTruthy();
    expect(screen.queryByText("Onboarding view")).toBeNull();
  });

  it("focuses the name of the enable form when the path holds the enablement hash", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValue(RE);
    mount("#enablement");

    const form = await screen.findByRole("form", { name: "Enable re@1" });

    expect(within(form).getByLabelText("Agent provider name")).toHaveFocus();
  });

  it("leaves the focus alone when the path holds no enablement hash", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValue(RE);
    mount();

    const form = await screen.findByRole("form", { name: "Enable re@1" });

    expect(within(form).getByLabelText("Agent provider name")).not.toHaveFocus();
  });

  it("explains the agent provider name of the enable form", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValue(RE);
    mount();

    const form = await screen.findByRole("form", { name: "Enable re@1" });
    expect(
      within(form).getByText(
        /Reuse the name of an agent provider that has the same LLM credential/,
      ),
    ).toBeTruthy();
  });

  it("prefills the name of an agent provider of another agent with the same credential", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValue(RE);
    vi.mocked(credentialsApi.listAllCredentials).mockResolvedValue([ROUTER_MAIN]);
    vi.mocked(workersApi.listAgentEnablements).mockResolvedValue([
      { ...ENABLEMENT, agent_name: "swe@1" },
    ]);
    vi.mocked(workersApi.listCredentialModels).mockResolvedValue([]);
    mount();

    const form = await screen.findByRole("form", { name: "Enable re@1" });
    await choose("LLM credential", "router-main (openrouter)");

    await waitFor(() =>
      expect(within(form).getByLabelText("Agent provider name")).toHaveValue("router"),
    );
  });

  it("keeps the name that the human typed", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValue(RE);
    vi.mocked(credentialsApi.listAllCredentials).mockResolvedValue([ROUTER_MAIN]);
    vi.mocked(workersApi.listAgentEnablements).mockResolvedValue([
      { ...ENABLEMENT, agent_name: "swe@1" },
    ]);
    vi.mocked(workersApi.listCredentialModels).mockResolvedValue([]);
    mount();

    const form = await screen.findByRole("form", { name: "Enable re@1" });
    await userEvent.type(within(form).getByLabelText("Agent provider name"), "mine");
    await choose("LLM credential", "router-main (openrouter)");

    expect(within(form).getByLabelText("Agent provider name")).toHaveValue("mine");
  });

  it("replaces a prefilled name when the human picks another credential", async () => {
    const codex: Credential = {
      name: "codex-main",
      platform: "openai-codex",
      holder: "server",
      sealed_to: null,
      sealed_current: true,
      revisions: [],
    };
    const bare: Credential = {
      name: "bare-main",
      platform: "openrouter",
      holder: "server",
      sealed_to: null,
      sealed_current: true,
      revisions: [],
    };
    vi.mocked(workersApi.readAgent).mockResolvedValue(RE);
    vi.mocked(credentialsApi.listAllCredentials).mockResolvedValue([ROUTER_MAIN, codex, bare]);
    vi.mocked(workersApi.listAgentEnablements).mockResolvedValue([
      {
        ...ENABLEMENT,
        agent_name: "swe@1",
        agent_providers: [
          { name: "router", provider: "openrouter", credential: "router-main" },
          { name: "codex-shared", provider: "openai-codex", credential: "codex-main" },
        ],
      },
    ]);
    vi.mocked(workersApi.listCredentialModels).mockResolvedValue([]);
    mount();

    const form = await screen.findByRole("form", { name: "Enable re@1" });
    const name = within(form).getByLabelText("Agent provider name");
    await choose("LLM credential", "router-main (openrouter)");
    await waitFor(() => expect(name).toHaveValue("router"));
    await choose("LLM credential", "codex-main (openai-codex)");
    await waitFor(() => expect(name).toHaveValue("codex-shared"));
    await choose("LLM credential", "bare-main (openrouter)");

    await waitFor(() => expect(name).toHaveValue(""));
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

  it("defaults the reasoning effort to medium when the first model lists it", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValue(RE);
    vi.mocked(credentialsApi.listAllCredentials).mockResolvedValue([ROUTER_MAIN]);
    vi.mocked(workersApi.listCredentialModels).mockResolvedValue([
      { model_identifier: "gpt-5", reasoning_efforts: ["minimal", "medium", "high"] },
      { model_identifier: "glm-4.6", reasoning_efforts: ["minimal"] },
    ]);
    mount();

    const form = await screen.findByRole("form", { name: "Enable re@1" });
    await choose("LLM credential", "router-main (openrouter)");
    const effort = within(form).getByRole("combobox", { name: "Reasoning effort" });
    await waitFor(() => expect(effort).toHaveTextContent("medium"));
    await choose("Model identifier", "glm-4.6");

    await waitFor(() => expect(effort).toHaveTextContent("Choose"));
  });

  it("asks before it enables the agent with an unhealthy credential", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValue(RE);
    vi.mocked(credentialsApi.listAllCredentials).mockResolvedValue([ROUTER_MAIN]);
    vi.mocked(credentialsApi.verifyCredential).mockResolvedValue({
      status: "unhealthy",
      capability: "model-list read",
      failure_reason: "unauthorized",
    });
    vi.mocked(workersApi.putAgentEnablement)
      .mockClear()
      .mockResolvedValue({ ...ENABLEMENT, revision: 1 });
    vi.mocked(workersApi.listCredentialModels).mockResolvedValue([
      { model_identifier: "qwen/qwen3-coder", reasoning_efforts: ["medium"] },
    ]);
    mount();

    const form = await screen.findByRole("form", { name: "Enable re@1" });
    await userEvent.type(within(form).getByLabelText("Agent provider name"), "router");
    await choose("LLM credential", "router-main (openrouter)");
    expect(credentialsApi.verifyCredential).toHaveBeenCalledWith("llm", "router-main");
    await waitFor(() =>
      expect(within(form).getByRole("combobox", { name: "Reasoning effort" })).toHaveTextContent(
        "medium",
      ),
    );
    await userEvent.click(within(form).getByRole("button", { name: "Enable agent" }));
    const guard = await screen.findByRole("alertdialog", {
      name: "Enable re@1 with an unhealthy credential?",
    });
    expect(within(guard).getByText(/The provider refused the API key/)).toBeTruthy();
    await userEvent.click(within(guard).getByRole("button", { name: "Keep editing" }));
    expect(workersApi.putAgentEnablement).not.toHaveBeenCalled();

    await userEvent.click(within(form).getByRole("button", { name: "Enable agent" }));
    await userEvent.click(await screen.findByRole("button", { name: "Enable anyway" }));

    await waitFor(() => expect(workersApi.putAgentEnablement).toHaveBeenCalledOnce());
  });

  it("waits for a late verify answer before it enables the agent", async () => {
    let answer: (entry: HealthEntry) => void = () => {};
    vi.mocked(workersApi.readAgent).mockResolvedValue(RE);
    vi.mocked(credentialsApi.listAllCredentials).mockResolvedValue([ROUTER_MAIN]);
    vi.mocked(credentialsApi.verifyCredential).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    vi.mocked(workersApi.putAgentEnablement).mockClear();
    vi.mocked(workersApi.listCredentialModels).mockResolvedValue([
      { model_identifier: "qwen/qwen3-coder", reasoning_efforts: ["medium"] },
    ]);
    mount();

    const form = await screen.findByRole("form", { name: "Enable re@1" });
    await userEvent.type(within(form).getByLabelText("Agent provider name"), "router");
    await choose("LLM credential", "router-main (openrouter)");
    await waitFor(() =>
      expect(within(form).getByRole("combobox", { name: "Reasoning effort" })).toHaveTextContent(
        "medium",
      ),
    );
    await userEvent.click(within(form).getByRole("button", { name: "Enable agent" }));
    expect(workersApi.putAgentEnablement).not.toHaveBeenCalled();
    answer({ status: "unhealthy", capability: "model-list read", failure_reason: "unclassified" });

    expect(
      await screen.findByRole("alertdialog", {
        name: "Enable re@1 with an unhealthy credential?",
      }),
    ).toBeTruthy();
    expect(workersApi.putAgentEnablement).not.toHaveBeenCalled();
  });

  it("explains that an agent provider joins a credential and a model to an agent", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValue(RE);
    mount();

    const form = await screen.findByRole("form", { name: "Enable re@1" });

    expect(
      within(form).getByText("An agent provider joins an LLM credential and a model to an agent."),
    ).toBeTruthy();
  });

  it("disables an enabled agent after a confirmation at the revision that it reads again", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValue({ ...RE, enablement: ENABLEMENT });
    vi.mocked(workersApi.readAgentEnablement).mockResolvedValue(ENABLEMENT);
    vi.mocked(workersApi.disableAgentEnablement).mockResolvedValue({
      ...ENABLEMENT,
      state: "disabled",
      revision: 3,
    });
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Disable re@1" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Disable re@1?" });
    expect(workersApi.disableAgentEnablement).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Disable agent" }));

    expect(workersApi.readAgentEnablement).toHaveBeenCalledWith("re@1");
    expect(workersApi.disableAgentEnablement).toHaveBeenCalledWith("re@1", 2);
    expect(screen.queryByRole("form", { name: "Enable re@1" })).toBeNull();
  });

  it("enables a disabled agent at its revision", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValue({
      ...RE,
      enablement: { ...ENABLEMENT, state: "disabled", revision: 3 },
    });
    vi.mocked(workersApi.readAgentEnablement).mockResolvedValue({
      ...ENABLEMENT,
      state: "disabled",
      revision: 3,
    });
    vi.mocked(workersApi.enableAgentEnablement).mockResolvedValue({ ...ENABLEMENT, revision: 4 });
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Enable re@1" }));

    await waitFor(() => expect(workersApi.enableAgentEnablement).toHaveBeenCalledWith("re@1", 3));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("adds an agent provider from a credential and derives its provider", async () => {
    const codex: Credential = {
      name: "codex-main",
      platform: "openai-codex",
      holder: "server",
      sealed_to: null,
      sealed_current: true,
      revisions: [],
    };
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
    expect(within(sheet).getByText(textContent("Provider: openai-codex"))).toBeTruthy();
    await userEvent.click(within(sheet).getByRole("button", { name: "Add agent provider" }));

    expect(workersApi.addAgentProvider).toHaveBeenCalledWith("re@1", {
      expected_revision: 2,
      name: "codex",
      provider: "openai-codex",
      credential: "codex-main",
    });
  });

  it("explains the name and prefills it from an agent provider of another agent", async () => {
    const codex: Credential = {
      name: "codex-main",
      platform: "openai-codex",
      holder: "server",
      sealed_to: null,
      sealed_current: true,
      revisions: [],
    };
    vi.mocked(workersApi.readAgent).mockResolvedValue({ ...RE, enablement: ENABLEMENT });
    vi.mocked(credentialsApi.listAllCredentials).mockResolvedValue([ROUTER_MAIN, codex]);
    vi.mocked(workersApi.listAgentEnablements).mockResolvedValue([
      ENABLEMENT,
      {
        ...ENABLEMENT,
        agent_name: "swe@1",
        agent_providers: [
          { name: "codex-shared", provider: "openai-codex", credential: "codex-main" },
        ],
      },
    ]);
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Add agent provider" }));
    const sheet = await screen.findByRole("dialog");
    expect(
      within(sheet).getByText(
        /Reuse the name of an agent provider that has the same LLM credential/,
      ),
    ).toBeTruthy();
    await choose("LLM credential", "codex-main (openai-codex)");

    await waitFor(() =>
      expect(within(sheet).getByRole("textbox", { name: "Name" })).toHaveValue("codex-shared"),
    );
  });

  it("clears a prefilled name in the add sheet when the next credential has no known name", async () => {
    const codex: Credential = {
      name: "codex-main",
      platform: "openai-codex",
      holder: "server",
      sealed_to: null,
      sealed_current: true,
      revisions: [],
    };
    const bare: Credential = {
      name: "bare-main",
      platform: "openrouter",
      holder: "server",
      sealed_to: null,
      sealed_current: true,
      revisions: [],
    };
    vi.mocked(workersApi.readAgent).mockResolvedValue({ ...RE, enablement: ENABLEMENT });
    vi.mocked(credentialsApi.listAllCredentials).mockResolvedValue([ROUTER_MAIN, codex, bare]);
    vi.mocked(workersApi.listAgentEnablements).mockResolvedValue([
      ENABLEMENT,
      {
        ...ENABLEMENT,
        agent_name: "swe@1",
        agent_providers: [
          { name: "codex-shared", provider: "openai-codex", credential: "codex-main" },
        ],
      },
    ]);
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Add agent provider" }));
    const sheet = await screen.findByRole("dialog");
    const name = within(sheet).getByRole("textbox", { name: "Name" });
    await choose("LLM credential", "codex-main (openai-codex)");
    await waitFor(() => expect(name).toHaveValue("codex-shared"));
    await choose("LLM credential", "bare-main (openrouter)");

    await waitFor(() => expect(name).toHaveValue(""));
  });

  it("adds an anthropic-subscription agent provider", async () => {
    const claude: Credential = {
      name: "claude-main",
      platform: "anthropic-subscription",
      holder: "server",
      sealed_to: null,
      sealed_current: true,
      revisions: [],
    };
    vi.mocked(workersApi.readAgent).mockResolvedValue({ ...RE, enablement: ENABLEMENT });
    vi.mocked(credentialsApi.listAllCredentials).mockResolvedValue([ROUTER_MAIN, claude]);
    vi.mocked(workersApi.addAgentProvider).mockResolvedValue({
      ...ENABLEMENT,
      agent_providers: [
        ...ENABLEMENT.agent_providers,
        { name: "claude", provider: "anthropic-subscription", credential: "claude-main" },
      ],
      revision: 3,
    });
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Add agent provider" }));
    const sheet = await screen.findByRole("dialog");
    await userEvent.type(within(sheet).getByRole("textbox", { name: "Name" }), "claude");
    await choose("LLM credential", "claude-main (anthropic-subscription)");
    expect(within(sheet).getByText(textContent("Provider: anthropic-subscription"))).toBeTruthy();
    await userEvent.click(within(sheet).getByRole("button", { name: "Add agent provider" }));

    expect(workersApi.addAgentProvider).toHaveBeenCalledWith("re@1", {
      expected_revision: 2,
      name: "claude",
      provider: "anthropic-subscription",
      credential: "claude-main",
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
  it("saves a new default configuration and keeps the agent providers and the fallback chain", async () => {
    const two: AgentEnablement = {
      ...ENABLEMENT,
      agent_providers: [
        ...ENABLEMENT.agent_providers,
        { name: "codex", provider: "openai-codex", credential: "codex-main" },
      ],
      fallback_configurations: [
        { agent_provider: "router", model_identifier: "qwen/qwen3-max", reasoning_effort: "off" },
      ],
    };
    vi.mocked(workersApi.readAgent).mockResolvedValue({ ...RE, enablement: two });
    vi.mocked(workersApi.listAgentProviderModels).mockImplementation(async (_agent, provider) =>
      provider === "codex"
        ? [{ model_identifier: "gpt-5-codex", reasoning_efforts: ["low", "medium", "high"] }]
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
        reasoning_effort: "medium",
      },
      fallback_configurations: two.fallback_configurations,
    });
  });

  it("leaves the effort of an edited default empty and required when the model lacks medium", async () => {
    vi.mocked(workersApi.readAgent).mockResolvedValue({ ...RE, enablement: ENABLEMENT });
    vi.mocked(workersApi.listAgentProviderModels).mockResolvedValue([
      { model_identifier: "qwen/qwen3-coder", reasoning_efforts: ["off"] },
      { model_identifier: "glm-4.6", reasoning_efforts: ["low", "high"] },
    ]);
    vi.mocked(workersApi.putAgentEnablement).mockClear();
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Edit default" }));
    const sheet = await screen.findByRole("dialog");
    await waitFor(() => expect(workersApi.listAgentProviderModels).toHaveBeenCalled());
    await choose("Model Identifier", "glm-4.6");

    const effort = within(sheet).getByRole("combobox", { name: "Reasoning Effort" });
    await waitFor(() => expect(effort).toHaveTextContent("Choose"));
    expect(within(sheet).getByText("Fill Reasoning Effort to save the default.")).toBeTruthy();
    const save = within(sheet).getByRole("button", { name: "Save default" });
    expect(save).toBeDisabled();
    await userEvent.click(save);
    expect(workersApi.putAgentEnablement).not.toHaveBeenCalled();
  });
});
