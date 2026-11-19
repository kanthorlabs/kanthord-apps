import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as agentApi from "@/api/resources/agent";
import * as workbenchApi from "@/api/resources/workbench";
import * as workersApi from "@/api/resources/workers";
import type { AgentEnablement, AgentSummary, AgentVariantItem } from "@/api/types";

vi.mock("@/api/resources/agent");
vi.mock("@/api/resources/workbench");
vi.mock("@/api/resources/workers");

import { newSessionPath } from "@/lib/workbench-new-session";
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

const VARIANT: AgentVariantItem = {
  id: "agent_variant_1",
  agent_name: "swe@1",
  display_name: "Software Architecture",
  revision: 1,
};

function Opened() {
  const { pathname, search } = useLocation();
  return <p>Opened {`${pathname}${search}`}</p>;
}

function Host({ agents }: { readonly agents: readonly AgentSummary[] }) {
  const navigate = useNavigate();
  return (
    <NewSessionDialog
      agents={agents}
      initialAgentName={null}
      onClose={vi.fn()}
      onStart={(agentName, configuration, agentDisplayName, variantId) =>
        navigate(newSessionPath(agentName, configuration, agentDisplayName, variantId))
      }
    />
  );
}

function mount(agents: readonly AgentSummary[]) {
  vi.mocked(workersApi.listAgentProviderModels).mockResolvedValue([
    { model_identifier: "qwen3-coder", reasoning_efforts: ["off"] },
  ]);
  return render(
    <MemoryRouter initialEntries={["/workbench"]}>
      <Routes>
        <Route path="/workbench" element={<Host agents={agents} />} />
        <Route path="/workbench/new" element={<Opened />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("NewSessionDialog", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(agentApi.listAgentVariants).mockResolvedValue([]);
  });

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

  it("offers a base agent as display name and agent name and a variant as its name and its base", async () => {
    vi.mocked(agentApi.listAgentVariants).mockResolvedValue([VARIANT]);
    mount([OPS, SWE]);

    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("combobox", { name: "Agent" }));

    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "Yumi (ops@1)",
      "SWE (swe@1)",
      "Software Architecture (variant of SWE)",
    ]);
  });

  it("omits the variant of a disabled base agent", async () => {
    vi.mocked(agentApi.listAgentVariants).mockResolvedValue([
      VARIANT,
      { ...VARIANT, id: "agent_variant_2", agent_name: "ops@1", display_name: "Ops Variant" },
    ]);
    mount([{ ...OPS, enablement: { ...OPS.enablement!, state: "disabled" } }, SWE]);

    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("combobox", { name: "Agent" }));

    expect(
      await screen.findByRole("option", { name: "Software Architecture (variant of SWE)" }),
    ).toBeTruthy();
    expect(screen.queryByRole("option", { name: /Ops Variant/ })).toBeNull();
    expect(screen.queryByRole("option", { name: /Yumi/ })).toBeNull();
  });

  it("omits the variant of an agent that serves no Workbench", async () => {
    vi.mocked(agentApi.listAgentVariants).mockResolvedValue([
      { ...VARIANT, id: "agent_variant_3", agent_name: "guard@1", display_name: "Guard Variant" },
    ]);
    mount([GUARD, SWE]);

    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("combobox", { name: "Agent" }));

    expect(await screen.findByRole("option", { name: "SWE (swe@1)" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /Guard Variant/ })).toBeNull();
  });

  it("opens the new-session route with the variant id and the base configuration and writes nothing", async () => {
    vi.mocked(agentApi.listAgentVariants).mockResolvedValue([VARIANT]);
    mount([SWE]);

    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("combobox", { name: "Agent" }));
    await userEvent.click(
      await screen.findByRole("option", { name: "Software Architecture (variant of SWE)" }),
    );
    expect(await within(dialog).findByRole("combobox", { name: "Model Identifier" })).toHaveValue(
      "qwen3-coder",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Start Session" }));

    const opened = await screen.findByText(/^Opened \/workbench\/new\?/);
    const query = new URLSearchParams(opened.textContent?.replace(/^Opened [^?]*\?/, ""));
    expect(Object.fromEntries(query)).toEqual({
      agent_name: "swe@1",
      display_name: "SWE",
      variant_id: "agent_variant_1",
      ...ENABLEMENT.default_configuration,
    });
    expect(workbenchApi.createWorkbenchSession).not.toHaveBeenCalled();
    expect(workbenchApi.sendWorkbenchMessage).not.toHaveBeenCalled();
    expect(workbenchApi.configureWorkbenchSession).not.toHaveBeenCalled();
    expect(agentApi.createAgentVariant).not.toHaveBeenCalled();
  });

  it("shows the failure of the variant read and still offers the base agents", async () => {
    vi.mocked(agentApi.listAgentVariants).mockRejectedValue(
      new ApiError("unavailable", "The variants did not load.", 503),
    );
    mount([SWE]);

    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "unavailable The variants did not load.",
    );
    await userEvent.click(within(dialog).getByRole("combobox", { name: "Agent" }));
    expect(await screen.findByRole("option", { name: "SWE (swe@1)" })).toBeTruthy();
  });
});
