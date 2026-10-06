import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as workbenchApi from "@/api/resources/workbench";
import * as workersApi from "@/api/resources/workers";
import type { AgentDeclaration, WorkbenchSession } from "@/api/types";

vi.mock("@/api/resources/workbench");
vi.mock("@/api/resources/workers");

import { ChatScreen } from "./chat-screen";

const SESSION_ID = "workbench_session_01J9ZQ4XKM3B6V8N2R5T7W0AB1";

const SESSION: WorkbenchSession = {
  id: SESSION_ID,
  agentName: "swe@1",
  configuration: {
    agentProvider: "atlas-llm",
    modelIdentifier: "gpt-5",
    reasoningEffort: "off",
  },
  entries: [
    {
      type: "message",
      id: "e1",
      parentId: null,
      timestamp: "2026-10-05T09:00:00.000Z",
      message: { role: "user", content: "List the open objectives" },
    },
  ],
  runActive: false,
};

const AGENT: AgentDeclaration = {
  agentName: "swe@1",
  configurationSchema: {},
  overridableFields: [],
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
  agentPrompt: "",
  tools: [],
};

function mount() {
  return render(
    <MemoryRouter initialEntries={[`/agents/swe%401/workbench/${SESSION_ID}`]}>
      <Routes>
        <Route path="/agents/:agentName/workbench/:sessionId" element={<ChatScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(workbenchApi.readWorkbenchEvents).mockImplementation(
    () => new Promise(() => undefined),
  );
  vi.mocked(workersApi.readAgent).mockResolvedValue(AGENT);
  vi.mocked(workersApi.listAgentProviderModels).mockResolvedValue([
    { modelIdentifier: "gpt-5", reasoningEfforts: ["off"] },
  ]);
});

describe("ChatScreen", () => {
  it("resumes the session named in the path and follows it after its last entry", async () => {
    vi.mocked(workbenchApi.readWorkbenchSession).mockResolvedValue(SESSION);
    mount();

    expect(await screen.findByText("List the open objectives")).toBeTruthy();
    expect(workbenchApi.readWorkbenchSession).toHaveBeenCalledWith(SESSION_ID);
    expect(workbenchApi.readWorkbenchEvents).toHaveBeenCalledWith(
      SESSION_ID,
      "e1",
      null,
      expect.anything(),
    );
  });

  it("offers the agent providers of the enablement of the agent", async () => {
    vi.mocked(workbenchApi.readWorkbenchSession).mockResolvedValue(SESSION);
    mount();

    await userEvent.click(await screen.findByRole("combobox", { name: "Agent Provider" }));

    expect(await screen.findByRole("option", { name: "openai-org" })).toBeTruthy();
  });

  it("lists the models of the agent provider of the session from the daemon", async () => {
    vi.mocked(workbenchApi.readWorkbenchSession).mockResolvedValue(SESSION);
    mount();

    await screen.findByRole("combobox", { name: "Model" });

    expect(workersApi.listAgentProviderModels).toHaveBeenCalledWith("swe@1", "atlas-llm");
  });

  it("reports a failed read with Retry", async () => {
    vi.mocked(workbenchApi.readWorkbenchSession).mockRejectedValueOnce(
      new ApiError("not_found", "The workbench session does not exist.", 404),
    );
    mount();

    expect(await screen.findByText("The workbench session does not exist.")).toBeTruthy();
    vi.mocked(workbenchApi.readWorkbenchSession).mockResolvedValue(SESSION);
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("List the open objectives")).toBeTruthy();
  });
});
