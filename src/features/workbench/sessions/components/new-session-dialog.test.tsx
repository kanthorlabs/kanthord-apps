import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import * as workersApi from "@/api/resources/workers";
import type { AgentEnablement, AgentSummary } from "@/api/types";

vi.mock("@/api/resources/workers");

import { NewSessionDialog } from "./new-session-dialog";

const ENABLEMENT: AgentEnablement = {
  agent_name: "swe@1",
  state: "enabled",
  agent_providers: [{ name: "atlas-llm", provider: "openai-compatible", credential: "atlas-main" }],
  default_configuration: {
    agent_provider: "atlas-llm",
    model_identifier: "qwen3-coder",
    reasoning_effort: "off",
  },
  fallback_configurations: [],
  revision: 2,
};

const COUNTS = { builtin: 0, "kanthord-mcp": 0, host: 0, operation: 0, workbench: 0 };

const SWE: AgentSummary = {
  agentName: "swe@1",
  displayName: "SWE",
  workerNames: ["coder@1"],
  consumers: ["workbench", "worker"],
  toolCounts: COUNTS,
  enablement: ENABLEMENT,
};

const OPS: AgentSummary = {
  ...SWE,
  agentName: "ops@1",
  displayName: "Yumi",
  workerNames: [],
  consumers: ["workbench"],
  enablement: { ...ENABLEMENT, agent_name: "ops@1" },
};

const GUARD: AgentSummary = {
  ...SWE,
  agentName: "guard@1",
  displayName: "Guard",
  workerNames: [],
  consumers: [],
  enablement: { ...ENABLEMENT, agent_name: "guard@1" },
};

function mount(agents: readonly AgentSummary[]) {
  vi.mocked(workersApi.listAgentProviderModels).mockResolvedValue([
    { model_identifier: "qwen3-coder", reasoning_efforts: ["off"] },
  ]);
  return render(
    <MemoryRouter>
      <NewSessionDialog
        agents={agents}
        initialAgentName={null}
        onClose={vi.fn()}
        onStart={vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe("NewSessionDialog", () => {
  it("offers only the enabled agents that a Workbench runs and omits guard@1", async () => {
    mount([GUARD, OPS, SWE]);

    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("combobox", { name: "Agent" }));

    expect(await screen.findByRole("option", { name: "Yumi (ops@1)" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "SWE (swe@1)" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Guard (guard@1)" })).toBeNull();
  });

  it("offers no agent when guard@1 is the only enabled agent", async () => {
    mount([GUARD]);

    const dialog = await screen.findByRole("dialog");

    expect(
      within(dialog).getByText("No agent is enabled. Enable an agent on the Agents page."),
    ).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Start Session" })).toBeDisabled();
  });
});
