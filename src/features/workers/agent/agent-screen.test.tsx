import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import * as workersApi from "@/api/resources/workers";
import type { AgentDeclaration } from "@/api/types";

vi.mock("@/api/resources/workers");

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
});
