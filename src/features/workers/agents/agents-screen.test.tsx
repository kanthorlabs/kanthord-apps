import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as workbenchApi from "@/api/resources/workbench";
import * as workersApi from "@/api/resources/workers";
import type { AgentSummary } from "@/api/types";

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

function mount() {
  return render(
    <MemoryRouter initialEntries={["/agents"]}>
      <Routes>
        <Route path="/agents" element={<AgentsScreen />} />
        <Route path="/workbench/new" element={<NewRoute />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AgentsScreen", () => {
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
    ).toEqual({ agent_name: "swe@1", ...SWE.enablement!.default_configuration });
    expect(workbenchApi.createWorkbenchSession).not.toHaveBeenCalled();
  });

  it("disables the New Session button of an enabled agent that does not serve the Workbench", async () => {
    const PE: AgentSummary = {
      ...SWE,
      agentName: "pe@1",
      displayName: "PE",
      consumers: ["worker"],
    };
    vi.mocked(workersApi.listAgents).mockResolvedValue([PE]);
    mount();

    expect(await screen.findByRole("button", { name: "New session with pe@1" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("reports a failed read", async () => {
    vi.mocked(workersApi.listAgents).mockRejectedValue(
      new ApiError("unavailable", "The daemon did not answer.", 503),
    );
    mount();

    expect(await screen.findByText("The daemon did not answer.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });
});
