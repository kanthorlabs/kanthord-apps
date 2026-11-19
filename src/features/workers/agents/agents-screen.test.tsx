import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as agentApi from "@/api/resources/agent";
import * as workbenchApi from "@/api/resources/workbench";
import * as workersApi from "@/api/resources/workers";
import type { AgentSummary, AgentVariant } from "@/api/types";

vi.mock("@/api/resources/agent");
vi.mock("@/api/resources/workbench");
vi.mock("@/api/resources/workers");

import { AgentsScreen } from "./agents-screen";

const SWE: AgentSummary = {
  agentName: "swe@1",
  displayName: "SWE",
  workerNames: ["coder@1"],
  consumers: ["workbench", "worker"],
  toolCounts: { builtin: 0, "kanthord-mcp": 0, host: 0, operation: 0, workbench: 0 },
  enablement: {
    agent_name: "swe@1",
    state: "enabled",
    agent_providers: [
      { name: "atlas-llm", provider: "openai-compatible", credential: "atlas-main" },
      { name: "openai-org", provider: "openai-compatible", credential: "openai-main" },
    ],
    default_configuration: {
      agent_provider: "atlas-llm",
      model_identifier: "qwen3-coder",
      reasoning_effort: "off",
    },
    fallback_configurations: [],
    revision: 2,
  },
};

const RE: AgentSummary = {
  agentName: "re@1",
  displayName: "RE",
  workerNames: ["reviewer@1"],
  consumers: ["workbench", "worker"],
  toolCounts: { builtin: 0, "kanthord-mcp": 0, host: 0, operation: 0, workbench: 0 },
  enablement: null,
};

const OPS: AgentSummary = {
  agentName: "ops@1",
  displayName: "Yumi",
  workerNames: [],
  consumers: ["workbench"],
  toolCounts: { builtin: 0, "kanthord-mcp": 0, host: 0, operation: 3, workbench: 0 },
  enablement: null,
};

function NewRoute() {
  const { search } = useLocation();
  return <p>New {search}</p>;
}

function VariantRoute() {
  const { pathname } = useLocation();
  return <p>Variant page {pathname}</p>;
}

function mount() {
  return render(
    <MemoryRouter initialEntries={["/agents"]}>
      <Routes>
        <Route path="/agents" element={<AgentsScreen />} />
        <Route path="/workbench/new" element={<NewRoute />} />
        <Route path="/agents/:agentName/variants/:variantId" element={<VariantRoute />} />
      </Routes>
    </MemoryRouter>,
  );
}

const VARIANT: AgentVariant = {
  id: "agent_variant_1",
  agent_name: "swe@1",
  display_name: "Software Architecture",
  instruction: "Weigh each change against the structure.",
  revision: 1,
};

const GUARD: AgentSummary = {
  agentName: "guard@1",
  displayName: "Guard",
  workerNames: [],
  consumers: [],
  toolCounts: { builtin: 0, "kanthord-mcp": 0, host: 0, operation: 0, workbench: 0 },
  enablement: { ...SWE.enablement!, agent_name: "guard@1" },
};

async function openNewVariant(agentName: string) {
  const row = (
    await screen.findByRole("link", { name: new RegExp(`\\(${agentName}\\)$`) })
  ).closest('[role="listitem"]') as HTMLElement;
  await userEvent.click(within(row).getByRole("button", { name: "New variant" }));
  return screen.findByRole("dialog");
}

async function fillVariant(dialog: HTMLElement, name: string, instruction: string) {
  await userEvent.type(within(dialog).getByLabelText("Display name"), name);
  await userEvent.type(within(dialog).getByLabelText("Instruction"), instruction);
  await userEvent.click(within(dialog).getByRole("button", { name: "Create variant" }));
}

describe("AgentsScreen", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(agentApi.listAgentVariants).mockResolvedValue([]);
  });

  it("lists a catalog agent that has no enablement", async () => {
    vi.mocked(workersApi.listAgents).mockResolvedValue([RE, SWE]);
    mount();

    const items = within(await screen.findByRole("list", { name: "Agents" })).getAllByRole(
      "listitem",
    );
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByText("RE (re@1)")).toBeTruthy();
    expect(within(items[0]!).getByText("not enabled")).toBeTruthy();
    expect(within(items[0]!).getByText("reviewer@1")).toBeTruthy();
  });

  it("lists ops@1 as Yumi (ops@1)", async () => {
    vi.mocked(workersApi.listAgents).mockResolvedValue([OPS]);
    mount();

    expect(await screen.findByRole("link", { name: "Yumi (ops@1)" })).toHaveAttribute(
      "href",
      "/agents/ops%401",
    );
  });

  it("shows the non-zero tool counts of a row and No tools for an agent with none", async () => {
    vi.mocked(workersApi.listAgents).mockResolvedValue([
      {
        ...SWE,
        toolCounts: { builtin: 7, "kanthord-mcp": 0, host: 1, operation: 7, workbench: 0 },
      },
      RE,
    ]);
    mount();

    const items = within(await screen.findByRole("list", { name: "Agents" })).getAllByRole(
      "listitem",
    );
    expect(within(items[0]!).getByText("7 builtin, 1 host, 7 operation")).toBeTruthy();
    expect(within(items[1]!).getByText("No tools")).toBeTruthy();
  });

  it("links the Enable button of a not enabled agent to the enablement form", async () => {
    vi.mocked(workersApi.listAgents).mockResolvedValue([RE, SWE]);
    mount();

    const items = within(await screen.findByRole("list", { name: "Agents" })).getAllByRole(
      "listitem",
    );
    expect(within(items[1]!).queryByRole("button", { name: "Enable swe@1" })).toBeNull();
    expect(within(items[0]!).getByRole("button", { name: "Enable re@1" })).toHaveAttribute(
      "href",
      "/agents/re%401#enablement",
    );
  });

  it("shows the providers and the default configuration of an enabled agent", async () => {
    vi.mocked(workersApi.listAgents).mockResolvedValue([SWE]);
    mount();

    expect(await screen.findByText("enabled")).toBeTruthy();
    expect(screen.getByText("atlas-llm, openai-org")).toBeTruthy();
    expect(screen.getByText(/qwen3-coder/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "SWE (swe@1)" })).toHaveAttribute(
      "href",
      "/agents/swe%401",
    );
  });

  it("starts a session of an enabled agent from its row and opens the new-session route", async () => {
    vi.mocked(workersApi.listAgents).mockResolvedValue([RE, SWE]);
    vi.mocked(workersApi.listAgentProviderModels).mockResolvedValue([
      { model_identifier: "qwen3-coder", reasoning_efforts: ["off"] },
    ]);
    mount();

    expect(await screen.findByRole("button", { name: "New session with re@1" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await userEvent.click(screen.getByRole("button", { name: "New session with swe@1" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Start Session" }));

    const route = await screen.findByText(/^New \?/);
    expect(
      Object.fromEntries(new URLSearchParams(route.textContent?.replace(/^New /, ""))),
    ).toEqual({
      agent_name: "swe@1",
      display_name: SWE.displayName,
      ...SWE.enablement!.default_configuration,
    });
    expect(workbenchApi.createWorkbenchSession).not.toHaveBeenCalled();
  });

  it("shows no New Session button for an enabled agent that does not serve the Workbench", async () => {
    const PE: AgentSummary = {
      ...SWE,
      agentName: "pe@1",
      displayName: "PE",
      consumers: ["worker"],
    };
    vi.mocked(workersApi.listAgents).mockResolvedValue([PE]);
    mount();

    expect(await screen.findByRole("link", { name: "PE (pe@1)" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "New session with pe@1" })).toBeNull();
  });

  it("lists guard@1 with no New Session button and keeps the button of ops@1", async () => {
    vi.mocked(workersApi.listAgents).mockResolvedValue([
      GUARD,
      { ...OPS, enablement: SWE.enablement },
    ]);
    mount();

    const items = await screen.findAllByRole("listitem");
    expect(within(items[0]!).getByRole("link", { name: "Guard (guard@1)" })).toBeTruthy();
    expect(within(items[0]!).queryByRole("button", { name: /New session/ })).toBeNull();
    expect(within(items[1]!).getByRole("button", { name: "New session with ops@1" })).toBeEnabled();
  });

  it("reports a failed read", async () => {
    vi.mocked(workersApi.listAgents).mockRejectedValue(
      new ApiError("unavailable", "The daemon did not answer.", 503),
    );
    mount();

    expect(await screen.findByText("The daemon did not answer.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("lists the variants of the swe@1 row with the revision and links to the variant page", async () => {
    vi.mocked(workersApi.listAgents).mockResolvedValue([RE, SWE]);
    vi.mocked(agentApi.listAgentVariants).mockResolvedValue([VARIANT]);
    mount();

    const list = await screen.findByRole("list", { name: "Variants of swe@1" });
    const link = within(list).getByRole("link", { name: "Software Architecture (v1)" });
    expect(link).toHaveAttribute("href", "/agents/swe%401/variants/agent_variant_1");
    expect(screen.queryByRole("list", { name: "Variants of re@1" })).toBeNull();
    expect(agentApi.listAgentVariants).toHaveBeenCalledTimes(1);

    await userEvent.click(link);

    expect(
      await screen.findByText("Variant page /agents/swe%401/variants/agent_variant_1"),
    ).toBeTruthy();
  });

  it("offers New variant on each session agent row and none on guard@1", async () => {
    vi.mocked(workersApi.listAgents).mockResolvedValue([GUARD, OPS, SWE]);
    mount();

    const items = await screen.findAllByRole("listitem");
    expect(within(items[0]!).queryByRole("button", { name: "New variant" })).toBeNull();
    expect(within(items[1]!).getByRole("button", { name: "New variant" })).toBeTruthy();
    expect(within(items[2]!).getByRole("button", { name: "New variant" })).toBeTruthy();
  });

  it("creates a variant of swe@1 and opens the variant page", async () => {
    vi.mocked(workersApi.listAgents).mockResolvedValue([SWE]);
    vi.mocked(agentApi.createAgentVariant).mockResolvedValue(VARIANT);
    mount();

    const dialog = await openNewVariant("swe@1");
    expect(within(dialog).getByText(/1 to 40 letters, digits, spaces, _ or -/)).toBeTruthy();
    await fillVariant(dialog, "Software Architecture", "Weigh each change.");

    expect(agentApi.createAgentVariant).toHaveBeenCalledWith({
      agent_name: "swe@1",
      display_name: "Software Architecture",
      instruction: "Weigh each change.",
    });
    expect(
      await screen.findByText("Variant page /agents/swe%401/variants/agent_variant_1"),
    ).toBeTruthy();
  });

  it("refuses a name that breaks the rule under the name field before any call", async () => {
    vi.mocked(workersApi.listAgents).mockResolvedValue([SWE]);
    mount();

    const dialog = await openNewVariant("swe@1");
    await fillVariant(dialog, "1st", "Text.");

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "1 to 40 letters, digits, spaces, _ or -, starting with a letter.",
    );
    expect(agentApi.createAgentVariant).not.toHaveBeenCalled();
  });

  it("shows a name_taken answer under the name field and keeps the draft", async () => {
    vi.mocked(workersApi.listAgents).mockResolvedValue([SWE]);
    vi.mocked(agentApi.createAgentVariant).mockRejectedValue(
      new ApiError("conflict", "Another variant uses the name.", 409, "agent.variant.name_taken"),
    );
    mount();

    const dialog = await openNewVariant("swe@1");
    await fillVariant(dialog, "Software Architecture", "Weigh each change.");

    const line = await within(dialog).findByRole("alert");
    expect(line).toHaveTextContent("agent.variant.name_taken Another variant uses the name.");
    expect(line.closest('[data-slot="field"]')).toContainElement(
      within(dialog).getByLabelText("Display name"),
    );
    expect(within(dialog).getByLabelText("Display name")).toHaveValue("Software Architecture");
    expect(within(dialog).getByLabelText("Instruction")).toHaveValue("Weigh each change.");
    expect(screen.queryByText(/^Variant page/)).toBeNull();
  });

  it("shows the instruction line under the editor for a validation answer and keeps the draft", async () => {
    vi.mocked(workersApi.listAgents).mockResolvedValue([SWE]);
    vi.mocked(agentApi.createAgentVariant).mockRejectedValue(
      new ApiError(
        "malformed",
        "Request validation failed.",
        400,
        "gateway.request.validation_failed",
        [{ path: ["body", "instruction"], code: "custom" }],
      ),
    );
    mount();

    const dialog = await openNewVariant("swe@1");
    await fillVariant(dialog, "Software Architecture", "Weigh each change.");

    const line = await within(dialog).findByRole("alert");
    expect(line).toHaveTextContent(
      "gateway.request.validation_failed The instruction is blank or above 32768 bytes.",
    );
    expect(line.closest('[data-slot="field"]')).toContainElement(
      within(dialog).getByLabelText("Instruction"),
    );
    expect(within(dialog).getByLabelText("Display name")).toHaveValue("Software Architecture");
    expect(within(dialog).getByLabelText("Instruction")).toHaveValue("Weigh each change.");
  });

  it("reports a failed variant read", async () => {
    vi.mocked(workersApi.listAgents).mockResolvedValue([SWE]);
    vi.mocked(agentApi.listAgentVariants).mockRejectedValue(
      new ApiError("unavailable", "The variants did not load.", 503),
    );
    mount();

    expect(await screen.findByText("The variants did not load.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });
});
