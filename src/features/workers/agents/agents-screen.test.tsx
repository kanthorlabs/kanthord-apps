import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as workersApi from "@/api/resources/workers";
import type { AgentSummary } from "@/api/types";

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

function mount() {
  return render(
    <MemoryRouter>
      <AgentsScreen />
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

  it("links each agent to its workbench", async () => {
    vi.mocked(workersApi.listAgents).mockResolvedValue([RE, SWE]);
    mount();

    expect(await screen.findByRole("button", { name: "Open workbench of swe@1" })).toHaveAttribute(
      "href",
      "/agents/swe%401/workbench",
    );
    expect(screen.getByRole("button", { name: "Open workbench of re@1" })).toBeTruthy();
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
