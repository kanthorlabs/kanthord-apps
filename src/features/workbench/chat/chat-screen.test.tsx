import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
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

const NEW_QUERY = new URLSearchParams({
  agent_name: "ops@1",
  agent_provider: "atlas-llm",
  model_identifier: "qwen3-coder",
  reasoning_effort: "off",
});

const OPS_SUMMARY = {
  agentName: "ops@1",
  displayName: "Yumi",
  workerNames: [],
  consumers: ["workbench"],
  toolCounts: { builtin: 0, "kanthord-mcp": 0, host: 0, operation: 3 },
  enablement: null,
} as const;

function Where() {
  const { pathname } = useLocation();
  return <p>Path {pathname}</p>;
}

function mountNew(query: URLSearchParams = NEW_QUERY) {
  return render(
    <MemoryRouter initialEntries={[`/workbench/new?${query}`]}>
      <Link to="/elsewhere">Leave</Link>
      <Where />
      <Routes>
        <Route path="/workbench/new" element={<ChatScreen />} />
        <Route path="/workbench/:sessionId" element={<ChatScreen />} />
        <Route path="/elsewhere" element={<p>Elsewhere</p>} />
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

  describe("in new-session mode", () => {
    beforeEach(() => {
      vi.mocked(workersApi.listAgents).mockResolvedValue([OPS_SUMMARY]);
      vi.mocked(workbenchApi.readWorkbenchSession).mockResolvedValue(SESSION);
    });

    it("greets with the display name of the agent and offers the composer", async () => {
      mountNew();

      expect(await screen.findByText(/Hello, I am Yumi\./)).toBeTruthy();
      expect(screen.getByRole("combobox", { name: "Message" })).toBeEnabled();
      expect(screen.getByRole("combobox", { name: "Model" })).toHaveTextContent("qwen3-coder");
      expect(workbenchApi.createWorkbenchSession).not.toHaveBeenCalled();
    });

    it("creates the conversation, then sends the message, then shows the conversation route", async () => {
      vi.mocked(workbenchApi.createWorkbenchSession).mockResolvedValue(SESSION);
      vi.mocked(workbenchApi.sendWorkbenchMessage).mockResolvedValue({
        session_id: SESSION_ID,
        run_active: true,
        queued_message_id: null,
        cleared: [],
      });
      mountNew();

      await userEvent.type(await screen.findByRole("combobox", { name: "Message" }), "List nodes");
      await userEvent.click(screen.getByRole("button", { name: "Send" }));

      expect(await screen.findByText(`Path /workbench/${SESSION_ID}`)).toBeTruthy();
      expect(workbenchApi.createWorkbenchSession).toHaveBeenCalledWith({
        agent_name: "ops@1",
        agent_provider: "atlas-llm",
        model_identifier: "qwen3-coder",
        reasoning_effort: "off",
      });
      expect(workbenchApi.sendWorkbenchMessage).toHaveBeenCalledWith(SESSION_ID, "List nodes");
      expect(
        vi.mocked(workbenchApi.createWorkbenchSession).mock.invocationCallOrder[0],
      ).toBeLessThan(vi.mocked(workbenchApi.sendWorkbenchMessage).mock.invocationCallOrder[0]!);
      expect(await screen.findByText("List the open nodes")).toBeTruthy();
    });

    it("keeps the route and calls no resource on /new alone", async () => {
      mountNew();

      await userEvent.type(await screen.findByRole("combobox", { name: "Message" }), "/new");
      await userEvent.click(screen.getByRole("button", { name: "Send" }));

      expect(screen.getByText("Path /workbench/new")).toBeTruthy();
      expect(workbenchApi.createWorkbenchSession).not.toHaveBeenCalled();
      expect(workbenchApi.sendWorkbenchMessage).not.toHaveBeenCalled();
    });

    it("shows the hint and calls no resource on /new with text", async () => {
      mountNew();

      await userEvent.type(await screen.findByRole("combobox", { name: "Message" }), "/new x");
      await userEvent.click(screen.getByRole("button", { name: "Send" }));

      expect(screen.getByText("/new takes no text yet")).toBeTruthy();
      expect(screen.getByRole("combobox", { name: "Message" })).toHaveValue("/new x");
      expect(workbenchApi.createWorkbenchSession).not.toHaveBeenCalled();
      expect(workbenchApi.sendWorkbenchMessage).not.toHaveBeenCalled();
    });

    it("writes nothing when the owner leaves with no message", async () => {
      mountNew();
      await screen.findByText(/Hello, I am Yumi\./);

      await userEvent.click(screen.getByRole("link", { name: "Leave" }));

      expect(await screen.findByText("Elsewhere")).toBeTruthy();
      expect(workbenchApi.createWorkbenchSession).not.toHaveBeenCalled();
      expect(workbenchApi.sendWorkbenchMessage).not.toHaveBeenCalled();
      expect(workbenchApi.configureWorkbenchSession).not.toHaveBeenCalled();
    });

    it("opens the created conversation, keeps the text and shows the error when the message fails", async () => {
      vi.mocked(workbenchApi.createWorkbenchSession).mockResolvedValue(SESSION);
      vi.mocked(workbenchApi.sendWorkbenchMessage).mockRejectedValue(
        new ApiError("conflict", "The workbench session holds an active run.", 409),
      );
      mountNew();

      await userEvent.type(await screen.findByRole("combobox", { name: "Message" }), "List nodes");
      await userEvent.click(screen.getByRole("button", { name: "Send" }));

      expect(await screen.findByText(`Path /workbench/${SESSION_ID}`)).toBeTruthy();
      expect(await screen.findByRole("combobox", { name: "Message" })).toHaveValue("List nodes");
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "conflict The workbench session holds an active run.",
      );
    });

    it("stays on the new-session route and keeps the text when the create fails", async () => {
      vi.mocked(workbenchApi.createWorkbenchSession).mockRejectedValue(
        new ApiError("refused", "The model is unknown.", 422),
      );
      mountNew();

      await userEvent.type(await screen.findByRole("combobox", { name: "Message" }), "List nodes");
      await userEvent.click(screen.getByRole("button", { name: "Send" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("refused The model is unknown.");
      expect(screen.getByText("Path /workbench/new")).toBeTruthy();
      expect(screen.getByRole("combobox", { name: "Message" })).toHaveValue("List nodes");
      expect(workbenchApi.sendWorkbenchMessage).not.toHaveBeenCalled();
    });

    it("shows the error line and sends nothing when the query is invalid", async () => {
      mountNew(new URLSearchParams({ agent_name: "ops@1" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "The address of this page holds no valid agent provider, model, reasoning effort.",
      );
      expect(screen.queryByRole("combobox", { name: "Message" })).toBeNull();
      expect(workbenchApi.createWorkbenchSession).not.toHaveBeenCalled();
    });
  });
});
