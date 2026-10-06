import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as workbenchApi from "@/api/resources/workbench";
import * as workersApi from "@/api/resources/workers";
import type { AgentSummary, WorkbenchSession } from "@/api/types";

vi.mock("@/api/resources/workbench");
vi.mock("@/api/resources/workers");

import { AgentsScreen } from "./agents-screen";

const SWE: AgentSummary = {
  agentName: "swe@1",
  workerNames: ["general@1"],
  enablement: {
    agentName: "swe@1",
    state: "enabled",
    agentProviders: [
      { name: "atlas-llm", provider: "openai-compatible", credential: "atlas-main" },
      { name: "openai-org", provider: "openai-compatible", credential: "openai-main" },
    ],
    defaultConfiguration: {
      agentProvider: "atlas-llm",
      modelIdentifier: "qwen3-coder",
      reasoningEffort: "off",
    },
    revision: 2,
  },
};

const RE: AgentSummary = { agentName: "re@1", workerNames: ["reviewer@1"], enablement: null };

function Opened() {
  const { sessionId } = useParams<{ sessionId: string }>();
  return <p>Opened {sessionId}</p>;
}

function mount() {
  return render(
    <MemoryRouter initialEntries={["/agents"]}>
      <Routes>
        <Route path="/agents" element={<AgentsScreen />} />
        <Route path="/workbench/:sessionId" element={<Opened />} />
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
    expect(within(items[0]!).getByText("re@1")).toBeTruthy();
    expect(within(items[0]!).getByText("not enabled")).toBeTruthy();
    expect(within(items[0]!).getByText("reviewer@1")).toBeTruthy();
  });

  it("shows the providers and the default configuration of an enabled agent", async () => {
    vi.mocked(workersApi.listAgents).mockResolvedValue([SWE]);
    mount();

    expect(await screen.findByText("enabled")).toBeTruthy();
    expect(screen.getByText("atlas-llm, openai-org")).toBeTruthy();
    expect(screen.getByText(/qwen3-coder/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "swe@1" })).toHaveAttribute("href", "/agents/swe%401");
  });

  it("starts a session of an enabled agent from its row and opens the chat", async () => {
    vi.mocked(workersApi.listAgents).mockResolvedValue([RE, SWE]);
    vi.mocked(workersApi.listAgentProviderModels).mockResolvedValue([
      { modelIdentifier: "qwen3-coder", reasoningEfforts: ["off"] },
    ]);
    const created: WorkbenchSession = {
      id: "workbench_session_CREATED",
      agentName: "swe@1",
      configuration: SWE.enablement!.defaultConfiguration,
      entries: [],
      runActive: false,
    };
    vi.mocked(workbenchApi.createWorkbenchSession).mockResolvedValue(created);
    mount();

    expect(await screen.findByRole("button", { name: "New session with re@1" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await userEvent.click(screen.getByRole("button", { name: "New session with swe@1" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Start Session" }));

    expect(workbenchApi.createWorkbenchSession).toHaveBeenCalledWith({
      agentName: "swe@1",
      ...SWE.enablement!.defaultConfiguration,
    });
    expect(await screen.findByText("Opened workbench_session_CREATED")).toBeTruthy();
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
