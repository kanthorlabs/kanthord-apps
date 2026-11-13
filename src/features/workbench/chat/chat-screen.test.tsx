import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as workbenchApi from "@/api/resources/workbench";
import * as workersApi from "@/api/resources/workers";
import type { AgentDeclaration, WorkbenchSession } from "@/api/types";

vi.mock("@/api/resources/workbench");
vi.mock("@/api/resources/workers");
vi.mock("@/features/auth/session/session-context", () => ({
  useSession: () => ({
    session: {
      instance: { id: "i-local", name: "local", baseUrl: "http://localhost:31415" },
      token: "jwt-1",
      identity: { kind: "human", sub: "kanthorlabs", name: "Ulrich" },
    },
  }),
}));

import { ChatScreen } from "./chat-screen";

const SESSION_ID = "workbench_session_01J9ZQ4XKM3B6V8N2R5T7W0AB1";

const SESSION: WorkbenchSession = {
  id: SESSION_ID,
  agent_name: "swe@1",
  configuration: {
    agent_provider: "atlas-llm",
    model_identifier: "gpt-5",
    reasoning_effort: "off",
  },
  entries: [
    {
      type: "message",
      id: "e1",
      parentId: null,
      timestamp: "2026-10-05T09:00:00.000Z",
      message: { role: "user", content: "List the open nodes" },
    },
  ],
  run_active: false,
  resume_command: "pi --session ~/session.jsonl",
};

const AGENT: AgentDeclaration = {
  agent_name: "swe@1",
  configuration_schema: {},
  overridable_fields: [],
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
  prompt: { parts: [], final: "" },
  tools: [],
  chain: [
    {
      position: 0,
      level: "enablement",
      agent_provider: "atlas-llm",
      provider: "openai-compatible",
      credential: "atlas-main",
      model_identifier: "qwen3-coder",
      reasoning_effort: "off",
      cooldown: null,
    },
  ],
  active_position: 0,
  cooling: null,
};

function mount() {
  return render(
    <MemoryRouter initialEntries={[`/workbench/${SESSION_ID}`]}>
      <Routes>
        <Route path="/workbench/:sessionId" element={<ChatScreen />} />
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
  vi.mocked(workersApi.listAgents).mockResolvedValue([
    {
      agentName: "swe@1",
      displayName: "SWE",
      workerNames: ["coder@1"],
      consumers: ["workbench", "worker"],
      toolCounts: { builtin: 0, "kanthord-mcp": 0, host: 0, operation: 0 },
      enablement: null,
    },
  ]);
  vi.mocked(workersApi.listAgentProviderModels).mockResolvedValue([
    { model_identifier: "gpt-5", reasoning_efforts: ["off"] },
  ]);
});

describe("ChatScreen", () => {
  it("resumes the session named in the path and follows it after its last entry", async () => {
    vi.mocked(workbenchApi.readWorkbenchSession).mockResolvedValue(SESSION);
    mount();

    expect(await screen.findByText("List the open nodes")).toBeTruthy();
    expect(workbenchApi.readWorkbenchSession).toHaveBeenCalledWith(SESSION_ID);
    await waitFor(() =>
      expect(workbenchApi.readWorkbenchEvents).toHaveBeenCalledWith(
        SESSION_ID,
        "e1",
        null,
        expect.anything(),
      ),
    );
  });

  it("names the owner from the session and the agent from the agent list", async () => {
    vi.mocked(workbenchApi.readWorkbenchSession).mockResolvedValue({
      ...SESSION,
      entries: [
        ...SESSION.entries,
        {
          type: "message",
          id: "e2",
          parentId: "e1",
          timestamp: "2026-10-05T09:01:00.000Z",
          message: { role: "assistant", content: [{ type: "text", text: "Two nodes." }] },
        },
      ],
    });
    mount();

    expect(await screen.findByText("Ulrich")).toBeTruthy();
    expect(screen.getByText("SWE")).toBeTruthy();
    expect(screen.getByRole("img", { name: "SWE avatar" })).toBeTruthy();
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

    await waitFor(() =>
      expect(workersApi.listAgentProviderModels).toHaveBeenCalledWith("swe@1", "atlas-llm"),
    );
  });

  it("reports a failed read with Retry", async () => {
    vi.mocked(workbenchApi.readWorkbenchSession).mockRejectedValueOnce(
      new ApiError("not_found", "The workbench session does not exist.", 404),
    );
    mount();

    expect(await screen.findByText("The workbench session does not exist.")).toBeTruthy();
    vi.mocked(workbenchApi.readWorkbenchSession).mockResolvedValue(SESSION);
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("List the open nodes")).toBeTruthy();
  });
});
