import { render, screen, waitFor, within } from "@testing-library/react";
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
  members: [{ session_id: SESSION_ID, agent_name: "swe@1", display_name: "SWE" }],
  entries: [
    {
      session_id: SESSION_ID,
      agent_name: "swe@1",
      type: "message",
      id: "e1",
      parentId: null,
      timestamp: "2026-10-05T09:00:00.000Z",
      message: { role: "user", content: "List the open nodes" },
    },
  ],
  run_active: false,
  forked_from: null,
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
  pinned_model_identifier: null,
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
  vi.mocked(workersApi.listAgents).mockResolvedValue([]);
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

  it("shows the run line with Stop under the request of a running session", async () => {
    vi.mocked(workbenchApi.readWorkbenchSession).mockResolvedValue({
      ...SESSION,
      run_active: true,
    });
    vi.mocked(workbenchApi.abortWorkbenchRun).mockResolvedValue({
      session_id: SESSION_ID,
      run_active: false,
      cleared: [],
    });
    mount();

    const line = await screen.findByRole("group", { name: "Run line" });
    expect(line.previousElementSibling).toHaveTextContent("List the open nodes");
    expect(within(line).getByText("· List the open nodes")).toBeInTheDocument();
    await userEvent.click(within(line).getByRole("button", { name: "Stop" }));

    expect(workbenchApi.abortWorkbenchRun).toHaveBeenCalledWith(SESSION_ID);
    await waitFor(() => expect(screen.queryByRole("group", { name: "Run line" })).toBeNull());
  });

  it("names the owner from the session and the agent from the members", async () => {
    vi.mocked(workbenchApi.readWorkbenchSession).mockResolvedValue({
      ...SESSION,
      entries: [
        ...SESSION.entries,
        {
          session_id: SESSION_ID,
          agent_name: "swe@1",
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
    expect(within(screen.getByRole("log", { name: "Transcript" })).getByText("SWE")).toBeTruthy();
    expect(screen.getByRole("img", { name: "SWE avatar" })).toBeTruthy();
  });

  it("renders the entries of two members in answer order under their display names", async () => {
    const GUEST_ID = "workbench_session_01J9ZQ4XKM3B6V8N2R5T7W0RE1";
    const assistant = (id: string, sessionId: string, agentName: string, text: string) => ({
      session_id: sessionId,
      agent_name: agentName,
      type: "message",
      id,
      parentId: null,
      timestamp: "2026-10-05T09:00:00.000Z",
      message: { role: "assistant", content: [{ type: "text", text }] },
    });
    vi.mocked(workbenchApi.readWorkbenchSession).mockResolvedValue({
      ...SESSION,
      members: [
        { session_id: SESSION_ID, agent_name: "swe@1", display_name: "SWE" },
        { session_id: GUEST_ID, agent_name: "re@1", display_name: "Ruby" },
      ],
      entries: [
        assistant("e1", SESSION_ID, "swe@1", "Hello, I am SWE."),
        assistant("e1", GUEST_ID, "re@1", "Ruby reviews."),
        assistant("e2", SESSION_ID, "swe@1", "Thanks, Ruby."),
      ],
    });
    mount();

    const log = await screen.findByRole("log", { name: "Transcript" });
    expect(
      within(log)
        .getAllByText(/^(SWE|Ruby)$/)
        .map((node) => node.textContent),
    ).toEqual(["SWE", "Ruby", "SWE"]);
    expect(within(log).getByRole("img", { name: "Ruby avatar" })).toBeTruthy();
    await waitFor(() =>
      expect(workbenchApi.readWorkbenchEvents).toHaveBeenCalledWith(
        SESSION_ID,
        `${SESSION_ID}:e2,${GUEST_ID}:e1`,
        null,
        expect.anything(),
      ),
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

  describe("with a participant", () => {
    const GUEST_ID = "workbench_session_01J9ZQ4XKM3B6V8N2R5T7W0RE1";
    const HOST_ID = "workbench_session_01J9ZQ4XKM3B6V8N2R5T7W0HO1";
    const RE_AGENT = {
      agentName: "re@1",
      displayName: "RE",
      workerNames: [],
      consumers: ["workbench" as const],
      toolCounts: { builtin: 0, "kanthord-mcp": 0, host: 0, operation: 0, workbench: 0 },
      enablement: AGENT.enablement,
    };
    const CONVERSATION: WorkbenchSession = {
      ...SESSION,
      members: [
        { session_id: SESSION_ID, agent_name: "swe@1", display_name: "SWE" },
        { session_id: GUEST_ID, agent_name: "re@1", display_name: "RE" },
      ],
      entries: [
        ...SESSION.entries,
        {
          session_id: GUEST_ID,
          agent_name: "re@1",
          type: "message",
          id: "e1",
          parentId: null,
          timestamp: "2026-10-05T09:01:00.000Z",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "RE reviews." }],
            stopReason: "stop",
          },
        },
      ],
    };

    function Where() {
      const { pathname, search } = useLocation();
      return <p>{`At ${pathname}${search}`}</p>;
    }

    function mountConversation() {
      return render(
        <MemoryRouter initialEntries={[`/workbench/${SESSION_ID}`]}>
          <Where />
          <Routes>
            <Route path="/workbench/new" element={<p>New chat</p>} />
            <Route path="/workbench/:sessionId" element={<ChatScreen />} />
          </Routes>
        </MemoryRouter>,
      );
    }

    beforeEach(() => {
      vi.mocked(workbenchApi.readWorkbenchSession).mockResolvedValue(CONVERSATION);
      vi.mocked(workersApi.listAgents).mockResolvedValue([RE_AGENT]);
    });

    it("titles the header with the host display name and shows one chip per member", async () => {
      mountConversation();

      expect(await screen.findByRole("heading", { name: "SWE conversation" })).toBeTruthy();
      const chips = screen.getByRole("group", { name: "Members" });
      expect(
        within(chips)
          .getAllByText(/./)
          .map((chip) => chip.textContent),
      ).toEqual(["SWE", "RE"]);
      expect(
        screen.getByRole("heading", { name: "SWE conversation" }).parentElement,
      ).toContainElement(chips);
      expect(
        screen.getByRole("heading", { name: "SWE conversation" }).parentElement,
      ).toContainElement(screen.getByRole("switch", { name: "Auto mode" }));
    });

    it("keeps the draft and shows the code when a mention send answers 404", async () => {
      vi.mocked(workbenchApi.sendWorkbenchMessage).mockRejectedValue(
        new ApiError(
          "not_found",
          "The agent is not in the catalog.",
          404,
          "agent.catalog.not_found",
        ),
      );
      mountConversation();

      await userEvent.type(await screen.findByRole("combobox", { name: "Message" }), "@RE look");
      await userEvent.click(screen.getByRole("button", { name: "Send" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "not_found The agent is not in the catalog.",
      );
      expect(screen.getByRole("combobox", { name: "Message" })).toHaveValue("@RE look");
      expect(screen.getByText(`At /workbench/${SESSION_ID}`)).toBeTruthy();
    });

    it("opens the host session when a send answers 409 workbench.session.not_host", async () => {
      vi.mocked(workbenchApi.sendWorkbenchMessage).mockRejectedValue(
        new ApiError(
          "conflict",
          "The workbench session is a participant.",
          409,
          "workbench.session.not_host",
          { host_session_id: HOST_ID },
        ),
      );
      mountConversation();

      await userEvent.type(await screen.findByRole("combobox", { name: "Message" }), "hello");
      await userEvent.click(screen.getByRole("button", { name: "Send" }));

      expect(await screen.findByText(`At /workbench/${HOST_ID}`)).toBeTruthy();
      expect(workbenchApi.readWorkbenchSession).toHaveBeenLastCalledWith(HOST_ID);
    });

    it("opens the host session when the read answers 409 workbench.session.not_host", async () => {
      vi.mocked(workbenchApi.readWorkbenchSession).mockRejectedValueOnce(
        new ApiError(
          "conflict",
          "The workbench session is a participant.",
          409,
          "workbench.session.not_host",
          { host_session_id: HOST_ID },
        ),
      );
      mountConversation();

      expect(await screen.findByText(`At /workbench/${HOST_ID}`)).toBeTruthy();
      expect(await screen.findByRole("heading", { name: "SWE conversation" })).toBeTruthy();
    });

    it("opens /new with the host agent, the host configuration and the host display name", async () => {
      mountConversation();

      await screen.findByText("RE reviews.");
      await userEvent.type(await screen.findByRole("combobox", { name: "Message" }), "/new");
      await userEvent.click(screen.getByRole("button", { name: "Send" }));

      const query = new URLSearchParams({
        agent_name: "swe@1",
        agent_provider: "atlas-llm",
        model_identifier: "gpt-5",
        reasoning_effort: "off",
        display_name: "SWE",
      });
      expect(await screen.findByText(`At /workbench/new?${query}`)).toBeTruthy();
    });

    describe("with /new and text", () => {
      const FORKED = { session_id: "workbench_session_FORK", run_active: true as const };
      const message = () => screen.findByRole("combobox", { name: "Message" });

      function pendingUntilAborted() {
        vi.mocked(workbenchApi.forkWorkbenchSession).mockImplementation(
          (_sessionId, input) =>
            new Promise((_resolve, reject) => {
              input.signal?.addEventListener("abort", () =>
                reject(new ApiError("unreachable", "The request was aborted.", 0)),
              );
            }),
        );
      }

      async function send(text: string) {
        await userEvent.type(await message(), text);
        await userEvent.click(screen.getByRole("button", { name: "Send" }));
      }

      it("forks once, also during a source run", async () => {
        vi.mocked(workbenchApi.readWorkbenchSession).mockResolvedValue({
          ...CONVERSATION,
          run_active: true,
        });
        pendingUntilAborted();
        mountConversation();
        await screen.findByRole("group", { name: "Run line" });

        await send("/new x");

        expect(workbenchApi.forkWorkbenchSession).toHaveBeenCalledTimes(1);
        expect(workbenchApi.forkWorkbenchSession).toHaveBeenCalledWith(SESSION_ID, {
          text: "x",
          signal: expect.any(AbortSignal),
        });
        expect(workbenchApi.sendWorkbenchMessage).not.toHaveBeenCalled();
      });

      it("shows Summarizing with Cancel above the composer and apart from the run line", async () => {
        vi.mocked(workbenchApi.readWorkbenchSession).mockResolvedValue({
          ...CONVERSATION,
          run_active: true,
        });
        pendingUntilAborted();
        mountConversation();
        await screen.findByRole("group", { name: "Run line" });

        await send("/new x");

        const line = await screen.findByRole("group", { name: "Summarizing line" });
        const composer = screen.getByRole("form", { name: "Composer" });
        expect(line).toHaveTextContent("Summarizing…");
        expect(within(line).getByRole("button", { name: "Cancel" })).toBeEnabled();
        expect(
          line.compareDocumentPosition(composer) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
        expect(
          within(screen.getByRole("group", { name: "Run line" })).queryByText(/Summarizing/),
        ).toBeNull();
        expect(line).not.toContainElement(screen.getByRole("group", { name: "Run line" }));
      });

      it("pushes the forked conversation on success", async () => {
        vi.mocked(workbenchApi.forkWorkbenchSession).mockResolvedValue(FORKED);
        mountConversation();

        await send("/new x");

        expect(await screen.findByText(`At /workbench/${FORKED.session_id}`)).toBeTruthy();
      });

      it("aborts the call on Cancel and keeps the text", async () => {
        pendingUntilAborted();
        mountConversation();
        await send("/new x");

        await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));

        await waitFor(() => expect(screen.queryByText("Summarizing…")).toBeNull());
        const signal = vi.mocked(workbenchApi.forkWorkbenchSession).mock.calls[0]![1].signal;
        expect(signal?.aborted).toBe(true);
        expect(await message()).toHaveValue("/new x");
        expect(screen.queryByRole("alert")).toBeNull();
        expect(screen.getByText(`At /workbench/${SESSION_ID}`)).toBeTruthy();
      });

      it.each([
        [
          "refused",
          { cause: "refused", reason: "The summary holds an order" },
          "Guard refused the summary: The summary holds an order.",
        ],
        [
          "refused with a period",
          { cause: "refused", reason: "The summary holds an order." },
          "Guard refused the summary: The summary holds an order.",
        ],
        [
          "unavailable",
          { cause: "unavailable", reason: null },
          "Guard is unavailable. Check guard@1 on the Agents page.",
        ],
        ["timeout", { cause: "timeout", reason: null }, "Guard refused the summary (timeout)."],
        [
          "no_verdict",
          { cause: "no_verdict", reason: null },
          "Guard refused the summary (no_verdict).",
        ],
        ["oversize", { cause: "oversize", reason: null }, "Guard refused the summary (oversize)."],
      ])("shows the line of the cause %s and keeps the text", async (_cause, details, line) => {
        vi.mocked(workbenchApi.forkWorkbenchSession).mockRejectedValue(
          new ApiError(
            "conflict",
            "The daemon refused the request.",
            409,
            "workbench.fork.summary_refused",
            details,
          ),
        );
        mountConversation();

        await send("/new x");

        const alert = await screen.findByRole("alert");
        expect(alert.textContent).toBe(`workbench.fork.summary_refused ${line}`);
        expect(await message()).toHaveValue("/new x");
      });

      it("shows the code of summary_failed and keeps the text", async () => {
        vi.mocked(workbenchApi.forkWorkbenchSession).mockRejectedValue(
          new ApiError("malformed", "Bad gateway.", 502, "workbench.fork.summary_failed"),
        );
        mountConversation();

        await send("/new x");

        const alert = await screen.findByRole("alert");
        expect(alert.textContent).toBe(
          "workbench.fork.summary_failed The summary could not be made. Try again.",
        );
        expect(await message()).toHaveValue("/new x");
      });

      it("calls fork once on a double Send", async () => {
        pendingUntilAborted();
        mountConversation();
        await userEvent.type(await message(), "/new x");

        const button = screen.getByRole("button", { name: "Send" });
        await userEvent.click(button);
        await userEvent.click(button);
        await userEvent.keyboard("{Enter}");

        expect(workbenchApi.forkWorkbenchSession).toHaveBeenCalledTimes(1);
      });

      it("names the host display name in the hint of /new", async () => {
        mountConversation();

        await userEvent.click(await message());
        await userEvent.type(await message(), "/");

        expect(
          await screen.findByText(
            "Start a new chat. With text, SWE's model summarizes this chat with your text as the instruction, and Guard checks the summary. Mention an agent to continue with it.",
          ),
        ).toBeTruthy();
      });

      it("opens the new-session route on /new alone and forks nothing", async () => {
        mountConversation();

        await send("/new");

        expect(await screen.findByText(/^At \/workbench\/new\?/)).toBeTruthy();
        expect(workbenchApi.forkWorkbenchSession).not.toHaveBeenCalled();
        expect(workbenchApi.sendWorkbenchMessage).not.toHaveBeenCalled();
      });
    });
  });

  describe("in new-session mode", () => {
    beforeEach(() => {
      vi.mocked(workbenchApi.readWorkbenchSession).mockResolvedValue(SESSION);
    });

    it("shows the greeting of the default template with the display name and the model", async () => {
      mountNew(new URLSearchParams([...NEW_QUERY, ["display_name", "Yumi"]]));

      expect(
        await screen.findByText("Hi, I am Yumi on qwen3-coder. What do you need?"),
      ).toBeTruthy();
      expect(screen.getByRole("combobox", { name: "Message" })).toBeEnabled();
      expect(screen.getByRole("combobox", { name: "Model" })).toHaveTextContent("qwen3-coder");
      expect(workbenchApi.createWorkbenchSession).not.toHaveBeenCalled();
    });

    it("creates the conversation, then sends the message, then shows the conversation route", async () => {
      vi.mocked(workbenchApi.createWorkbenchSession).mockResolvedValue(SESSION);
      vi.mocked(workbenchApi.sendWorkbenchMessage).mockResolvedValue({
        kind: "run",
        session_id: SESSION_ID,
        agent_name: null,
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

    it("lists the enabled session agents for an @ in the first message and shows the addressee", async () => {
      vi.mocked(workersApi.listAgents).mockResolvedValue([
        {
          agentName: "re@1",
          displayName: "RE",
          workerNames: [],
          consumers: ["workbench"],
          toolCounts: { builtin: 0, "kanthord-mcp": 0, host: 0, operation: 0, workbench: 0 },
          enablement: AGENT.enablement,
        },
        {
          agentName: "guard@1",
          displayName: "Guard",
          workerNames: [],
          consumers: [],
          toolCounts: { builtin: 0, "kanthord-mcp": 0, host: 0, operation: 0, workbench: 0 },
          enablement: AGENT.enablement,
        },
      ]);
      mountNew();

      await waitFor(() => expect(workersApi.listAgents).toHaveBeenCalled());
      await userEvent.type(await screen.findByRole("combobox", { name: "Message" }), "@");
      const list = await screen.findByRole("listbox", { name: "Mentions" });
      expect(
        within(list)
          .getAllByRole("option")
          .map((option) => option.textContent),
      ).toEqual(["RE"]);
      await userEvent.click(within(list).getByRole("option", { name: "RE" }));

      expect(screen.getByRole("combobox", { name: "Message" })).toHaveValue("@RE ");
      expect(screen.getByLabelText("Addressee")).toHaveTextContent(/^To @RE$/);
    });

    it("keeps the route and calls no resource on /new alone", async () => {
      mountNew();

      await userEvent.type(await screen.findByRole("combobox", { name: "Message" }), "/new");
      await userEvent.click(screen.getByRole("button", { name: "Send" }));

      expect(screen.getByText("Path /workbench/new")).toBeTruthy();
      expect(workbenchApi.createWorkbenchSession).not.toHaveBeenCalled();
      expect(workbenchApi.sendWorkbenchMessage).not.toHaveBeenCalled();
    });

    it("creates the conversation, then sends the text as the first message on /new with text", async () => {
      vi.mocked(workbenchApi.createWorkbenchSession).mockResolvedValue(SESSION);
      vi.mocked(workbenchApi.sendWorkbenchMessage).mockResolvedValue({
        kind: "run",
        session_id: SESSION_ID,
        agent_name: null,
        run_active: true,
        queued_message_id: null,
        cleared: [],
      });
      mountNew();

      await userEvent.type(await screen.findByRole("combobox", { name: "Message" }), "/new x");
      await userEvent.click(screen.getByRole("button", { name: "Send" }));

      expect(await screen.findByText(`Path /workbench/${SESSION_ID}`)).toBeTruthy();
      expect(workbenchApi.createWorkbenchSession).toHaveBeenCalledTimes(1);
      expect(workbenchApi.sendWorkbenchMessage).toHaveBeenCalledWith(SESSION_ID, "x");
      expect(workbenchApi.forkWorkbenchSession).not.toHaveBeenCalled();
      expect(
        vi.mocked(workbenchApi.createWorkbenchSession).mock.invocationCallOrder[0],
      ).toBeLessThan(vi.mocked(workbenchApi.sendWorkbenchMessage).mock.invocationCallOrder[0]!);
    });

    it("writes nothing when the owner leaves with no message", async () => {
      mountNew();
      await screen.findByText(/Write your first message below/);

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
