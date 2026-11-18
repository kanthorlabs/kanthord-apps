import type { ComponentProps } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as workbenchApi from "@/api/resources/workbench";
import * as workersApi from "@/api/resources/workers";
import type * as EvidenceDownload from "@/features/projects/view/use-evidence-download";
import type {
  AgentEnablement,
  WorkbenchMember,
  WorkbenchRunSnapshot,
  WorkbenchSession,
  WorkbenchSessionEntry,
  WorkbenchSessionEvents,
} from "@/api/types";
import { WORKBENCH_FORK_FRAME, WORKBENCH_FORK_PREFIX } from "@/api/types";

vi.mock("@/api/resources/workbench");
vi.mock("@/api/resources/workers");
vi.mock("@/features/projects/view/use-evidence-download", async (importOriginal) => ({
  ...(await importOriginal<typeof EvidenceDownload>()),
  useEvidenceDownload: vi.fn(),
}));

import { useEvidenceDownload } from "@/features/projects/view/use-evidence-download";
import { ChatView } from "./chat-view";
import { NewSessionChat } from "./new-session-chat";

const SESSION_ID = "workbench_session_01J9ZQ4XKM3B6V8N2R5T7W0AB1";

const HOST: WorkbenchMember = { session_id: SESSION_ID, agent_name: "swe@1", display_name: "SWE" };

const IDLE: WorkbenchRunSnapshot = {
  streaming_message: null,
  pending_tool_calls: [],
  pending_approval: null,
  queue: [],
  run_active: false,
  error_message: null,
  auto_mode: true,
  phase: null,
};

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

function message(id: string, body: Record<string, unknown>): WorkbenchSessionEntry {
  return {
    session_id: SESSION_ID,
    agent_name: "swe@1",
    type: "message",
    id,
    parentId: null,
    timestamp: "2026-10-05T09:00:00.000Z",
    message: body,
  };
}

function session(
  entries: readonly WorkbenchSessionEntry[] = [],
  runActive = false,
): WorkbenchSession {
  return {
    id: SESSION_ID,
    agent_name: "swe@1",
    configuration: ENABLEMENT.default_configuration,
    members: [HOST],
    entries,
    run_active: runActive,
    forked_from: null,
    resume_command: "pi --session ~/session.jsonl",
  };
}

function pollQueue() {
  const waiting: Array<(events: WorkbenchSessionEvents) => void> = [];
  let version = 0;
  vi.mocked(workbenchApi.readWorkbenchEvents).mockImplementation(
    () => new Promise((resolve) => waiting.push(resolve)),
  );
  return {
    async answer(events: {
      members?: WorkbenchSessionEvents["members"];
      entries?: WorkbenchSessionEvents["entries"];
      snapshot?: Partial<WorkbenchRunSnapshot>;
    }) {
      await waitFor(() => expect(waiting.length).toBeGreaterThan(0));
      waiting.shift()?.({
        members: events.members ?? [HOST],
        entries: events.entries ?? [],
        snapshot: { ...IDLE, ...events.snapshot },
        version: ++version,
      });
    },
  };
}

function mount(held: WorkbenchSession, slots: Partial<ComponentProps<typeof ChatView>> = {}) {
  return render(
    <MemoryRouter>
      <ChatView session={held} enablement={ENABLEMENT} ownerName="Ulrich" {...slots} />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(workbenchApi.listInvites).mockResolvedValue([]);
  vi.mocked(workersApi.listAgents).mockResolvedValue([]);
  vi.mocked(workersApi.listAgentProviderModels).mockResolvedValue([
    { model_identifier: "qwen3-coder", reasoning_efforts: ["off"] },
  ]);
});

describe("ChatView", () => {
  it("holds the Auto mode switch in the header, outside the transcript and the run line", async () => {
    const polls = pollQueue();
    mount(session([message("e1", { role: "user", content: "Run" })], true));
    await polls.answer({ snapshot: { run_active: true, auto_mode: false } });

    const autoMode = await screen.findByRole("switch", { name: "Auto mode" });
    expect(autoMode).not.toBeChecked();
    expect(
      screen.getByRole("heading", { name: "SWE conversation" }).parentElement,
    ).toContainElement(autoMode);
    expect(
      within(screen.getByRole("log", { name: "Transcript" })).queryByRole("switch"),
    ).toBeNull();
    expect(
      within(await screen.findByRole("group", { name: "Run line" })).queryByRole("switch"),
    ).toBeNull();
  });

  it("disables the Auto mode switch until the first poll answers", async () => {
    const polls = pollQueue();
    mount(session([], false));

    expect(screen.getByRole("switch", { name: "Auto mode" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await polls.answer({ snapshot: { auto_mode: false } });

    await waitFor(() =>
      expect(screen.getByRole("switch", { name: "Auto mode" })).not.toHaveAttribute(
        "aria-disabled",
        "true",
      ),
    );
    expect(screen.getByRole("switch", { name: "Auto mode" })).not.toBeChecked();
  });

  it("toggles auto mode while a run is active and shows the answer", async () => {
    const polls = pollQueue();
    vi.mocked(workbenchApi.setWorkbenchAutoMode).mockResolvedValue({
      session_id: SESSION_ID,
      enabled: false,
    });
    mount(session([], true));
    await polls.answer({ snapshot: { run_active: true, auto_mode: true } });

    await userEvent.click(await screen.findByRole("switch", { name: "Auto mode" }));

    expect(workbenchApi.setWorkbenchAutoMode).toHaveBeenCalledWith(SESSION_ID, false);
    await waitFor(() =>
      expect(screen.getByRole("switch", { name: "Auto mode" })).not.toBeChecked(),
    );
  });

  it("shows no Auto mode switch on the new-session route", () => {
    render(
      <MemoryRouter>
        <NewSessionChat
          agentName="swe@1"
          agentDisplayName="SWE"
          configuration={ENABLEMENT.default_configuration}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("switch", { name: "Auto mode" })).toBeNull();
    expect(screen.queryByText("Auto mode")).toBeNull();
  });

  it("shows the command name of an owner bubble with the fixed text of /brief", () => {
    pollQueue();
    mount(
      session([
        message("e1", {
          role: "user",
          content: "Report the system status and the actions that need me.",
        }),
      ]),
    );

    const text = screen.getByText("Report the system status and the actions that need me.");
    const name = screen.getByText("/brief");
    expect(name.parentElement).toBe(text.parentElement);
    expect(name.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(name).toHaveClass("block");
    expect(text).toHaveClass("block");
  });

  it("shows any other owner bubble as its text only", () => {
    pollQueue();
    mount(session([message("e1", { role: "user", content: "What needs me?" })]));

    expect(screen.getByText("What needs me?")).toBeInTheDocument();
    expect(screen.queryByText("/brief")).toBeNull();
  });

  it("renders user messages, assistant text, tool calls and tool results", () => {
    pollQueue();
    mount(
      session([
        message("e1", { role: "user", content: "List the open nodes" }),
        message("e2", {
          role: "assistant",
          content: [
            { type: "text", text: "I read the mission first." },
            { type: "toolCall", id: "call_1", name: "mission.node.list", arguments: { limit: 5 } },
          ],
        }),
        message("e3", {
          role: "toolResult",
          toolCallId: "call_1",
          toolName: "mission.node.list",
          isError: false,
          content: [{ type: "text", text: '{"items":[]}' }],
        }),
        message("e4", { role: "assistant", content: [{ type: "text", text: "Nothing is open." }] }),
      ]),
    );

    const log = screen.getByRole("log", { name: "Transcript" });
    expect(within(log).getByText("List the open nodes")).toBeTruthy();
    expect(within(log).getByText("I read the mission first.")).toBeTruthy();
    expect(within(log).getByRole("button", { name: "Tool Call mission.node.list" })).toBeTruthy();
    expect(within(log).getByRole("button", { name: "Tool Result mission.node.list" })).toBeTruthy();
    expect(within(log).getByText("Nothing is open.")).toBeTruthy();
  });

  it("renders the markdown of assistant text", () => {
    pollQueue();
    mount(
      session([
        message("e1", {
          role: "assistant",
          content: [{ type: "text", text: "## Plan\n\n- read **mission**\n- run `make up`" }],
        }),
      ]),
    );

    const log = screen.getByRole("log", { name: "Transcript" });
    expect(within(log).getByRole("heading", { name: "Plan", level: 2 })).toBeTruthy();
    expect(within(log).getAllByRole("listitem")).toHaveLength(2);
    expect(within(log).getByText("mission").tagName).toBe("STRONG");
    expect(within(log).getByText("make up").tagName).toBe("CODE");
  });

  it("copies the pi command that resumes the session", async () => {
    pollQueue();
    const user = userEvent.setup();
    mount(session());

    await user.click(screen.getByRole("button", { name: "Copy pi resume command" }));

    expect(await navigator.clipboard.readText()).toBe("pi --session ~/session.jsonl");
  });

  it("expands a tool call to show its whole input as pretty JSON", async () => {
    pollQueue();
    mount(
      session([
        message("e2", {
          role: "assistant",
          content: [{ type: "toolCall", id: "call_1", name: "read", arguments: { path: "a.md" } }],
        }),
      ]),
    );

    await userEvent.click(screen.getByRole("button", { name: "Tool Call read" }));

    expect(
      await screen.findByText(
        (_, element) =>
          element?.tagName === "PRE" && element.textContent === '{\n  "path": "a.md"\n}',
      ),
    ).toBeTruthy();
  });

  it("shows the idle state and the empty transcript of a new session", () => {
    pollQueue();
    mount(session());

    expect(screen.getByText("Idle")).toBeTruthy();
    expect(screen.getByText("No messages. Write the first one below.")).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Message" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();
  });

  it("renders the streaming partial message and the entries that arrive", async () => {
    const polls = pollQueue();
    mount(session([message("e1", { role: "user", content: "Hi" })], true));
    expect(screen.getByText("The agent is working")).toBeTruthy();

    await polls.answer({
      snapshot: {
        run_active: true,
        streaming_message: { role: "assistant", content: [{ type: "text", text: "Hel" }] },
      },
    });
    expect(await screen.findByText("Hel")).toBeTruthy();
    expect(screen.getByText("Streaming")).toBeTruthy();
    expect(screen.queryByText("The agent is working")).toBeNull();

    await polls.answer({
      entries: [message("e2", { role: "assistant", content: [{ type: "text", text: "Hello" }] })],
      snapshot: { run_active: false },
    });
    expect(await screen.findByText("Hello")).toBeTruthy();
    expect(screen.queryByText("Streaming")).toBeNull();
    expect(workbenchApi.readWorkbenchEvents).toHaveBeenLastCalledWith(
      SESSION_ID,
      "e2",
      expect.any(Number),
      expect.anything(),
    );
  });

  it("keeps the draft editable and keeps Send while a run is active", async () => {
    const polls = pollQueue();
    mount(session([], true));
    await polls.answer({ snapshot: { run_active: true } });

    expect(await screen.findByRole("group", { name: "Run line" })).toBeTruthy();
    expect(screen.getByText("The agent is working")).toBeTruthy();
    await userEvent.type(screen.getByRole("combobox", { name: "Message" }), "next step");

    expect(screen.getByRole("combobox", { name: "Message" })).toHaveValue("next step");
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
    expect(
      within(screen.getByRole("group", { name: "Run line" })).getByRole("button", { name: "Stop" }),
    ).toBeEnabled();
  });

  it("restarts the working counter when the next run starts with no idle state between", async () => {
    const realNow = Date.now();
    let offset = 0;
    vi.spyOn(Date, "now").mockImplementation(() => realNow + offset);
    const polls = pollQueue();
    mount(session([message("e1", { role: "user", content: "First" })], true));
    await polls.answer({ snapshot: { run_active: true } });
    offset = 85_000;
    expect(await screen.findByText("85s", undefined, { timeout: 3000 })).toBeTruthy();

    await polls.answer({
      entries: [message("e2", { role: "user", content: "Replacement" })],
      snapshot: { run_active: true },
    });

    expect(await screen.findByText("0s")).toBeTruthy();
  });

  it("shows the error message of a failed run", async () => {
    const polls = pollQueue();
    mount(session());

    await polls.answer({ snapshot: { error_message: "The model provider refused the request." } });

    expect(await screen.findByText("The model provider refused the request.")).toBeTruthy();
  });

  it("shows the operation and the input of a pending approval and approves it", async () => {
    const polls = pollQueue();
    vi.mocked(workbenchApi.approveWorkbenchCall).mockResolvedValue({
      session_id: SESSION_ID,
      tool_call_id: "call_2",
      approved: true,
    });
    mount(session([], true));

    await polls.answer({
      snapshot: {
        run_active: true,
        pending_approval: {
          session_id: SESSION_ID,
          requested_by: { kind: "owner", name: "Kanthor Labs" },
          tool_call_id: "call_2",
          operation_id: "project.create",
          guard: null,
          input: { name: "account-recovery" },
        },
      },
    });
    const card = await screen.findByRole("group", { name: "Approval Required" });
    expect(within(card).getByText("project.create")).toBeTruthy();
    expect(within(card).getByText(/"name": "account-recovery"/)).toBeTruthy();

    await userEvent.click(within(card).getByRole("button", { name: "Approve" }));

    expect(workbenchApi.approveWorkbenchCall).toHaveBeenCalledWith(SESSION_ID, "call_2", true);
    await waitFor(() =>
      expect(screen.queryByRole("group", { name: "Approval Required" })).toBeNull(),
    );
  });

  it("approves a call of a participant on the session id of that participant", async () => {
    const polls = pollQueue();
    const guest = { session_id: "workbench_session_RE1", agent_name: "re@1", display_name: "Ruby" };
    vi.mocked(workbenchApi.approveWorkbenchCall).mockResolvedValue({
      session_id: guest.session_id,
      tool_call_id: "call_7",
      approved: true,
    });
    mount(session([], true));

    await polls.answer({
      members: [HOST, guest],
      snapshot: {
        run_active: true,
        pending_approval: {
          session_id: guest.session_id,
          requested_by: { kind: "owner", name: "Kanthor Labs" },
          tool_call_id: "call_7",
          operation_id: "project.create",
          guard: null,
          input: { name: "account-recovery" },
        },
      },
    });
    const card = await screen.findByRole("group", { name: "Approval Required" });

    await userEvent.click(within(card).getByRole("button", { name: "Approve" }));

    expect(workbenchApi.approveWorkbenchCall).toHaveBeenCalledWith(
      guest.session_id,
      "call_7",
      true,
    );
  });

  it("renders the approval line in place of the approval card", async () => {
    const polls = pollQueue();
    mount(session([], true), { approvalLine: <p>Queued as #1</p> });

    await polls.answer({
      snapshot: {
        run_active: true,
        pending_approval: {
          session_id: SESSION_ID,
          requested_by: { kind: "owner", name: "Kanthor Labs" },
          tool_call_id: "call_2",
          operation_id: "project.create",
          input: {},
          guard: null,
        },
      },
    });

    expect(await screen.findByText("Queued as #1")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Approval Required" })).toBeNull();
  });

  it("renders the stream end after the stream and before the composer", async () => {
    pollQueue();
    mount(session([message("e1", { role: "user", content: "Hello" })]), {
      streamEnd: <p>Stream end</p>,
    });

    const end = await screen.findByText("Stream end");
    const composer = screen.getByRole("form", { name: "Composer" });
    expect(
      screen.getByText("Hello").compareDocumentPosition(end) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(end.compareDocumentPosition(composer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("closes the approval card when the stream clears the approval and no click happens", async () => {
    const polls = pollQueue();
    mount(session([], true));
    await polls.answer({
      snapshot: {
        run_active: true,
        pending_approval: {
          session_id: SESSION_ID,
          requested_by: { kind: "owner", name: "Kanthor Labs" },
          tool_call_id: "call_2",
          operation_id: "project.create",
          input: {},
          guard: null,
        },
      },
    });
    await screen.findByRole("group", { name: "Approval Required" });

    await polls.answer({ snapshot: { run_active: true, pending_approval: null } });

    await waitFor(() =>
      expect(screen.queryByRole("group", { name: "Approval Required" })).toBeNull(),
    );
    expect(workbenchApi.approveWorkbenchCall).not.toHaveBeenCalled();
  });

  it("replaces the approval card when the stream names another tool call", async () => {
    const polls = pollQueue();
    vi.mocked(workbenchApi.approveWorkbenchCall).mockRejectedValue(
      new ApiError("conflict", "The call is no longer pending.", 409),
    );
    mount(session([], true));
    await polls.answer({
      snapshot: {
        run_active: true,
        pending_approval: {
          session_id: SESSION_ID,
          requested_by: { kind: "owner", name: "Kanthor Labs" },
          tool_call_id: "call_2",
          operation_id: "project.create",
          input: {},
          guard: null,
        },
      },
    });
    await userEvent.click(await screen.findByRole("button", { name: "Approve" }));
    await screen.findByRole("alert");

    await polls.answer({
      snapshot: {
        run_active: true,
        pending_approval: {
          session_id: SESSION_ID,
          requested_by: { kind: "owner", name: "Kanthor Labs" },
          tool_call_id: "call_3",
          operation_id: "project.update",
          input: {},
          guard: null,
        },
      },
    });

    expect(await screen.findByText("project.update")).toBeTruthy();
    expect(screen.queryByText("project.create")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("rejects a pending approval", async () => {
    const polls = pollQueue();
    vi.mocked(workbenchApi.approveWorkbenchCall).mockResolvedValue({
      session_id: SESSION_ID,
      tool_call_id: "call_2",
      approved: false,
    });
    mount(session([], true));

    await polls.answer({
      snapshot: {
        run_active: true,
        pending_approval: {
          session_id: SESSION_ID,
          requested_by: { kind: "owner", name: "Kanthor Labs" },
          tool_call_id: "call_2",
          operation_id: "project.create",
          input: {},
          guard: null,
        },
      },
    });
    await userEvent.click(await screen.findByRole("button", { name: "Reject" }));

    expect(workbenchApi.approveWorkbenchCall).toHaveBeenCalledWith(SESSION_ID, "call_2", false);
  });

  it("sends the message, clears the draft and starts the run state at once", async () => {
    pollQueue();
    vi.mocked(workbenchApi.sendWorkbenchMessage).mockResolvedValue({
      kind: "run",
      session_id: SESSION_ID,
      agent_name: null,
      run_active: true,
      queued_message_id: null,
      cleared: [],
    });
    mount(session());

    await userEvent.type(screen.getByRole("combobox", { name: "Message" }), "List the nodes");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(workbenchApi.sendWorkbenchMessage).toHaveBeenCalledWith(
      SESSION_ID,
      "List the nodes",
      "queue",
    );
    expect(await screen.findByRole("group", { name: "Run line" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Message" })).toHaveValue("");
  });

  describe("after a send", () => {
    const FAILED_RUN = "The model provider refused the request.";

    async function mountWithFailedRun() {
      const polls = pollQueue();
      mount(session([message("e1", { role: "user", content: "Hi" })]));
      await polls.answer({
        entries: [],
        snapshot: { error_message: FAILED_RUN },
      });
      await screen.findByText(FAILED_RUN);
      await userEvent.type(screen.getByRole("combobox", { name: "Message" }), "next");
      await userEvent.click(screen.getByRole("button", { name: "Send" }));
    }

    it("adds a queued message to the snapshot queue before the next poll", async () => {
      pollQueue();
      vi.mocked(workbenchApi.sendWorkbenchMessage).mockResolvedValue({
        kind: "run",
        session_id: SESSION_ID,
        agent_name: null,
        run_active: true,
        queued_message_id: "queued_1",
        cleared: [],
      });
      mount(session());
      expect(screen.getByRole("combobox", { name: "Model" })).toBeEnabled();

      await userEvent.type(screen.getByRole("combobox", { name: "Message" }), "later");
      await userEvent.click(screen.getByRole("button", { name: "Send" }));

      await waitFor(() => expect(screen.getByRole("combobox", { name: "Model" })).toBeDisabled());
      expect(screen.queryByText("Running")).toBeNull();
    });

    it("shows the row of a queued message before the next poll", async () => {
      pollQueue();
      vi.mocked(workbenchApi.sendWorkbenchMessage).mockResolvedValue({
        kind: "run",
        session_id: SESSION_ID,
        agent_name: null,
        run_active: true,
        queued_message_id: "queued_1",
        cleared: [],
      });
      mount(session([], true));

      await userEvent.type(screen.getByRole("combobox", { name: "Message" }), "later{Enter}");

      const line = await screen.findByRole("button", { name: /1 queued/ });
      expect(line).toHaveTextContent("later");
      await userEvent.click(line);
      expect(await screen.findByRole("button", { name: "Remove" })).toBeEnabled();
    });

    it("keeps the error message when the message is queued", async () => {
      vi.mocked(workbenchApi.sendWorkbenchMessage).mockResolvedValue({
        kind: "run",
        session_id: SESSION_ID,
        agent_name: null,
        run_active: true,
        queued_message_id: "queued_1",
        cleared: [],
      });

      await mountWithFailedRun();

      await waitFor(() => expect(screen.getByRole("combobox", { name: "Model" })).toBeDisabled());
      expect(screen.getByText(FAILED_RUN)).toBeTruthy();
    });

    it("clears the error message when the send starts a run", async () => {
      vi.mocked(workbenchApi.sendWorkbenchMessage).mockResolvedValue({
        kind: "run",
        session_id: SESSION_ID,
        agent_name: null,
        run_active: true,
        queued_message_id: null,
        cleared: [],
      });

      await mountWithFailedRun();

      await waitFor(() => expect(screen.queryByText(FAILED_RUN)).toBeNull());
    });

    it("puts the cleared texts back into the composer", async () => {
      pollQueue();
      vi.mocked(workbenchApi.sendWorkbenchMessage).mockResolvedValue({
        kind: "run",
        session_id: SESSION_ID,
        agent_name: null,
        run_active: true,
        queued_message_id: null,
        cleared: [{ id: "queued_1", text: "queued one", agent_name: null, display_name: null }],
      });
      mount(session([], true));

      await userEvent.type(screen.getByRole("combobox", { name: "Message" }), "instead{Enter}");

      await waitFor(() =>
        expect(screen.getByRole("combobox", { name: "Message" })).toHaveValue("queued one"),
      );
    });
  });

  it("keeps the draft and names the refusal when the send fails", async () => {
    pollQueue();
    vi.mocked(workbenchApi.sendWorkbenchMessage).mockRejectedValue(
      new ApiError("conflict", "The workbench session holds an active run.", 409),
    );
    mount(session());

    await userEvent.type(screen.getByRole("combobox", { name: "Message" }), "again");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("The workbench session holds an active run.")).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Message" })).toHaveValue("again");
  });

  it("says that the connection failed while the long poll retries", async () => {
    vi.mocked(workbenchApi.readWorkbenchEvents).mockRejectedValueOnce(
      new ApiError("unreachable", "The daemon did not answer.", 0),
    );
    vi.mocked(workbenchApi.readWorkbenchEvents).mockImplementation(
      () => new Promise(() => undefined),
    );
    mount(session());

    expect(await screen.findByText(/The daemon did not answer\. Trying again\./)).toBeTruthy();
  });

  it("renders a Workbench path in agent text as a link", () => {
    pollQueue();
    mount(
      session([
        message("e1", {
          role: "assistant",
          content: [{ type: "text", text: "Open /missions/checkout/nodes/node_42 first." }],
        }),
      ]),
    );

    expect(screen.getByRole("link", { name: "/missions/checkout/nodes/node_42" })).toHaveAttribute(
      "href",
      `${window.location.origin}/missions/checkout/nodes/node_42`,
    );
  });

  it("opens a path link in a new tab and keeps the opener", async () => {
    pollQueue();
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    mount(
      session([
        message("e1", {
          role: "assistant",
          content: [{ type: "text", text: "Open /missions/checkout/nodes/node_42 first." }],
        }),
      ]),
    );

    await userEvent.click(screen.getByRole("link", { name: "/missions/checkout/nodes/node_42" }));

    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(
      `${window.location.origin}/missions/checkout/nodes/node_42`,
      "_blank",
    );
  });

  describe("fork", () => {
    const SOURCE_ID = "workbench_session_01J9ZQ4XKM3B6V8N2R5T7W0SRC";
    const SUMMARY = "The user asked for the node list.";

    function forked(sourceTitle = "List the nodes") {
      const record: WorkbenchSessionEntry = {
        session_id: SESSION_ID,
        agent_name: "swe@1",
        type: "custom",
        id: "e3",
        parentId: null,
        timestamp: "2026-10-05T09:00:00.000Z",
        customType: "kanthord.workbench.record",
        data: { kind: "fork", source_title: sourceTitle },
      };
      return {
        ...session([
          record,
          message("e4", {
            role: "user",
            content: `${WORKBENCH_FORK_PREFIX}${SOURCE_ID}.${WORKBENCH_FORK_FRAME}\n\n${SUMMARY}`,
          }),
          message("e7", { role: "user", content: "Go on" }),
        ]),
        forked_from: SOURCE_ID,
      };
    }

    it("shows the Forked from line and opens the source in a new tab with the opener", async () => {
      pollQueue();
      const open = vi.spyOn(window, "open").mockReturnValue(null);
      mount(forked());

      expect(screen.getByText(/^Forked from/)).toBeTruthy();
      await userEvent.click(screen.getByRole("link", { name: "List the nodes" }));

      expect(open).toHaveBeenCalledTimes(1);
      expect(open).toHaveBeenCalledWith(
        `${window.location.origin}/workbench/${SOURCE_ID}`,
        "_blank",
      );
    });

    it("collapses the summary block and shows the summary and the guard line when opened", async () => {
      pollQueue();
      mount(forked());

      const trigger = screen.getByRole("button", { name: "Summary of List the nodes" });
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByText(SUMMARY)).toBeNull();

      await userEvent.click(trigger);

      expect(await screen.findByText(SUMMARY)).toBeTruthy();
      expect(
        screen.getByText("Guard checked it for orders and secrets, not for accuracy."),
      ).toBeTruthy();
      expect(screen.queryByText(new RegExp(WORKBENCH_FORK_PREFIX))).toBeNull();
    });

    it("names an empty source title an earlier conversation in the line and the block", async () => {
      pollQueue();
      const open = vi.spyOn(window, "open").mockReturnValue(null);
      mount(forked(""));

      const link = screen.getByRole("link", { name: "an earlier conversation" });
      expect(
        screen.getByRole("button", { name: "Summary of an earlier conversation" }),
      ).toBeTruthy();
      await userEvent.click(link);

      expect(open).toHaveBeenCalledWith(
        `${window.location.origin}/workbench/${SOURCE_ID}`,
        "_blank",
      );
    });
  });

  it("keeps a slash command in agent text as plain text", () => {
    pollQueue();
    mount(
      session([
        message("e1", {
          role: "assistant",
          content: [{ type: "text", text: "Type /brief or /health or /new to go on." }],
        }),
      ]),
    );

    expect(screen.getByText("Type /brief or /health or /new to go on.")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows the error of a failed tool result directly under its row, in full", () => {
    pollQueue();
    const text = "The node node_42 refused the change because ".concat(
      "it holds a live claim. ".repeat(8),
    );
    mount(
      session([
        message("e1", {
          role: "toolResult",
          toolCallId: "call_1",
          toolName: "node.update",
          isError: true,
          content: [{ type: "text", text }],
        }),
      ]),
    );

    const row = screen.getByRole("button", { name: "Tool Result node.update" });
    const error = screen.getByRole("alert");
    expect(error.previousElementSibling).toContainElement(row);
    expect(error).toHaveTextContent(text.trim());
    expect(row).toHaveAccessibleDescription(text.trim());
  });

  it("shows the error code first and then the message under the approval card that failed", async () => {
    const polls = pollQueue();
    vi.mocked(workbenchApi.approveWorkbenchCall).mockRejectedValue(
      new ApiError("conflict", "The call is no longer pending.", 409),
    );
    mount(session([], true));
    await polls.answer({
      snapshot: {
        run_active: true,
        pending_approval: {
          session_id: SESSION_ID,
          requested_by: { kind: "owner", name: "Kanthor Labs" },
          tool_call_id: "call_2",
          operation_id: "project.create",
          input: {},
          guard: null,
        },
      },
    });

    await userEvent.click(await screen.findByRole("button", { name: "Approve" }));

    const card = await screen.findByRole("group", { name: "Approval Required" });
    const error = await screen.findByRole("alert");
    expect(error.previousElementSibling).toContainElement(card);
    expect(error).toHaveTextContent("conflict The call is no longer pending.");
    expect(card).toHaveAccessibleDescription("conflict The call is no longer pending.");
  });

  it("shows the error code first and then the message directly under the composer", async () => {
    pollQueue();
    vi.mocked(workbenchApi.sendWorkbenchMessage).mockRejectedValue(
      new ApiError("conflict", "The workbench session holds an active run.", 409),
    );
    mount(session());

    await userEvent.type(screen.getByRole("combobox", { name: "Message" }), "again");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    const error = await screen.findByRole("alert");
    expect(error.previousElementSibling).toBe(screen.getByRole("form", { name: "Composer" }));
    expect(error).toHaveTextContent("conflict The workbench session holds an active run.");
  });

  it("shows a run error under the message that started the run", async () => {
    const polls = pollQueue();
    mount(
      session([
        message("e1", { role: "user", content: "Plan the release" }),
        message("e2", { role: "assistant", content: [{ type: "text", text: "Planning." }] }),
        message("e3", { role: "user", content: "Start the run" }),
      ]),
    );

    await polls.answer({ snapshot: { error_message: "The model provider refused the request." } });

    const error = await screen.findByRole("alert");
    const bubble = screen.getByText("Start the run");
    expect(error.previousElementSibling).toBe(bubble);
    expect(bubble).toHaveAccessibleDescription("The model provider refused the request.");
    expect(screen.getByText("Plan the release")).not.toHaveAccessibleDescription(
      "The model provider refused the request.",
    );
  });

  it("shows the display name, the entry time and an avatar on an agent bubble", () => {
    pollQueue();
    const yumi = { session_id: SESSION_ID, agent_name: "ops@1", display_name: "Yumi" };
    mount({
      ...session([
        {
          ...message("e1", { role: "assistant", content: [{ type: "text", text: "Hello." }] }),
          agent_name: "ops@1",
        },
      ]),
      agent_name: "ops@1",
      members: [yumi],
    });

    expect(within(screen.getByRole("log", { name: "Transcript" })).getByText("Yumi")).toBeTruthy();
    expect(screen.getByText("2026-10-05 09:00 UTC")).toHaveAttribute(
      "datetime",
      "2026-10-05T09:00:00.000Z",
    );
    expect(screen.getByRole("img", { name: "Yumi avatar" })).toBeTruthy();
  });

  it("shows the owner name and the entry time on an owner bubble", () => {
    pollQueue();
    mount(session([message("e1", { role: "user", content: "List the nodes" })]));

    expect(screen.getByText("Ulrich")).toBeTruthy();
    expect(screen.getByText("2026-10-05 09:00 UTC")).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("shows no time on a streaming agent bubble until its entry arrives", async () => {
    const polls = pollQueue();
    mount(session([message("e1", { role: "user", content: "Hi" })], true));

    await polls.answer({
      snapshot: {
        run_active: true,
        streaming_message: { role: "assistant", content: [{ type: "text", text: "Hel" }] },
      },
    });

    expect(await screen.findByText("Hel")).toBeTruthy();
    expect(within(screen.getByRole("log", { name: "Transcript" })).getByText("SWE")).toBeTruthy();
    expect(screen.getAllByText(/UTC$/)).toHaveLength(1);
  });

  describe("evidence row", () => {
    const CONTENT_LINE = "SECRET-CONTENT-LINE";
    const download = vi.fn();

    function evidenceResult(size: number, length = 100) {
      const facts = {
        asset_id: "evidence_asset_1",
        node_id: "node_1",
        attempt: 2,
        media_type: "text/plain",
        size,
        offset: 10,
        length,
        truncated: true,
      };
      return message("e1", {
        role: "toolResult",
        toolCallId: "call_1",
        toolName: "evidence_read",
        isError: false,
        details: facts,
        content: [
          { type: "text", text: JSON.stringify(facts) },
          { type: "text", text: CONTENT_LINE },
        ],
      });
    }

    beforeEach(() => {
      download.mockReset();
      vi.mocked(useEvidenceDownload).mockReturnValue({ download, pending: false, error: null });
    });

    it("renders the facts and Download and no content line", async () => {
      pollQueue();
      mount(session([evidenceResult(120)]));

      const log = screen.getByRole("log", { name: "Transcript" });
      expect(within(log).getByText("evidence_read").tagName).toBe("CODE");
      expect(log).toHaveTextContent("· evidence_asset_1 · text/plain · 0.1 KiB · bytes 10–109");
      expect(log).toHaveTextContent("node_1 · attempt 2 · offset 10 · length 100 · truncated true");
      expect(log).not.toHaveTextContent(CONTENT_LINE);

      await userEvent.click(within(log).getByRole("button", { name: "Download" }));
      expect(download).toHaveBeenCalledWith("evidence_asset_1");
      expect(log.querySelector("details")).not.toHaveAttribute("open");
    });

    it("shows 0 bytes for a length of 0", () => {
      pollQueue();
      mount(session([evidenceResult(120, 0)]));

      const log = screen.getByRole("log", { name: "Transcript" });
      expect(log).toHaveTextContent("· text/plain · 0.1 KiB · 0 bytes");
      expect(log).not.toHaveTextContent("–-1");
    });

    it("shows the CLI line and no button above 512 MiB", () => {
      pollQueue();
      mount(session([evidenceResult(536870913)]));

      const log = screen.getByRole("log", { name: "Transcript" });
      expect(within(log).queryByRole("button", { name: "Download" })).toBeNull();
      expect(log).toHaveTextContent(
        "Too large for the dashboard. Use kanthord mission evidence asset content get evidence_asset_1.",
      );
    });

    it("shows the error line directly under the row", () => {
      pollQueue();
      vi.mocked(useEvidenceDownload).mockReturnValue({
        download,
        pending: false,
        error: new ApiError(
          "malformed",
          "The storage read failed.",
          502,
          "mission.evidence.content_unavailable",
        ),
      });
      mount(session([evidenceResult(120)]));

      const error = screen.getByRole("alert");
      expect(error).toHaveTextContent(
        "mission.evidence.content_unavailable: The storage read failed.",
      );
      expect(error.previousElementSibling).toHaveClass("border-destructive");
    });
  });
});

describe("ChatView plan and phases", () => {
  const JEREMY: WorkbenchMember = {
    session_id: SESSION_ID,
    agent_name: "plan@1",
    display_name: "Jeremy",
  };

  function planSession(entries: readonly WorkbenchSessionEntry[], runActive = false) {
    return { ...session(entries, runActive), agent_name: "plan@1", members: [JEREMY] };
  }

  function planEntry(
    unresolved: unknown,
    content = "## Steps\n\n- Add the retry",
  ): WorkbenchSessionEntry {
    return {
      session_id: SESSION_ID,
      agent_name: "plan@1",
      type: "custom_message",
      id: "p1",
      parentId: null,
      timestamp: "2026-10-05T09:00:00.000Z",
      customType: "kanthord.workbench.plan",
      content,
      display: true,
      details: { phases: [], unresolved },
    };
  }

  function phaseEntry(
    id: string,
    phase: "planner" | "reviewer",
    text: string,
  ): WorkbenchSessionEntry {
    return {
      session_id: `phase-${phase}`,
      agent_name: "plan@1",
      type: "message",
      id,
      parentId: null,
      timestamp: "2026-10-05T09:00:00.000Z",
      phase,
      message: { role: "assistant", content: [{ type: "text", text }] },
    };
  }

  it("renders the plan as Markdown with the author", () => {
    pollQueue();
    mount(planSession([planEntry(null)]));

    const log = screen.getByRole("log", { name: "Transcript" });
    expect(within(log).getByRole("heading", { name: "Steps" })).toBeTruthy();
    expect(within(log).getByRole("listitem")).toHaveTextContent("Add the retry");
    expect(within(log).getByText("Jeremy")).toBeTruthy();
    expect(within(log).getByRole("img", { name: "Jeremy avatar" })).toBeTruthy();
  });

  it("puts the plan and the warning line in a bordered panel with a muted background", () => {
    pollQueue();
    mount(planSession([planEntry(2)]));

    const panel = screen.getByRole("heading", { name: "Steps" }).closest("[data-slot=plan-panel]");
    expect(panel).toHaveClass("border", "bg-muted/50");
    expect(panel).toHaveTextContent("Review unresolved: 2 open action:YES findings");
    expect(panel).not.toHaveTextContent("Jeremy");
  });

  it("renders no raw HTML of the plan text", () => {
    pollQueue();
    mount(planSession([planEntry(null, "<b>bold</b> text")]));

    const log = screen.getByRole("log", { name: "Transcript" });
    expect(log.querySelector("b")).toBeNull();
  });

  it.each([
    [2, "Review unresolved: 2 open action:YES findings"],
    ["missing", "Review unresolved: no Review section"],
  ])("shows the warning line for %s", (unresolved, line) => {
    pollQueue();
    mount(planSession([planEntry(unresolved)]));

    expect(screen.getByText(line)).toBeTruthy();
  });

  it("shows no warning line for null", () => {
    pollQueue();
    mount(planSession([planEntry(null)]));

    expect(screen.queryByText(/Review unresolved/)).toBeNull();
  });

  it("renders the phase groups collapsed and expands one on a click", async () => {
    pollQueue();
    mount(
      planSession([
        phaseEntry("a1", "planner", "Draft of the steps"),
        phaseEntry("b1", "reviewer", "Review of the draft"),
        planEntry(null),
      ]),
    );

    const planner = screen.getByRole("button", { name: "Planner" });
    const reviewer = screen.getByRole("button", { name: "Reviewer" });
    expect(planner).toHaveAttribute("aria-expanded", "false");
    expect(reviewer).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Draft of the steps")).toBeNull();

    await userEvent.click(planner);

    expect(await screen.findByText("Draft of the steps")).toBeTruthy();
    expect(screen.queryByText("Review of the draft")).toBeNull();
  });

  it("styles the phase group trigger with a dashed border and muted small text", () => {
    pollQueue();
    mount(planSession([phaseEntry("a1", "planner", "Draft of the steps"), planEntry(null)]));

    expect(screen.getByRole("button", { name: "Planner" })).toHaveClass(
      "border-dashed",
      "text-xs",
      "text-muted-foreground",
    );
  });

  it("shows no user bubble in a phase group", async () => {
    pollQueue();
    const opening: WorkbenchSessionEntry = {
      ...phaseEntry("a0", "planner", ""),
      message: { role: "user", content: "Draft the plan of the request." },
    };
    mount(
      planSession([opening, phaseEntry("a1", "planner", "Draft of the steps"), planEntry(null)]),
    );

    await userEvent.click(screen.getByRole("button", { name: "Planner" }));

    expect(await screen.findByText("Draft of the steps")).toBeTruthy();
    expect(screen.queryByText("Draft the plan of the request.")).toBeNull();
  });

  it.each([
    ["planner", "Planner"],
    ["reviewer", "Reviewer"],
  ] as const)("reads Jeremy is planning with %s on the run line", async (phase, label) => {
    const polls = pollQueue();
    mount(planSession([message("e1", { role: "user", content: "Plan it" })], true));

    await polls.answer({ members: [JEREMY], snapshot: { run_active: true, phase } });

    const line = await screen.findByRole("group", { name: "Run line" });
    await waitFor(() => expect(line).toHaveTextContent("Jeremy is planning"));
    expect(line).toHaveTextContent(label);
    expect(screen.queryByText("The agent is working")).toBeNull();
  });

  it("keeps the working line for a run with no phase", () => {
    pollQueue();
    mount(session([message("e1", { role: "user", content: "Hi" })], true));

    expect(screen.getByText("The agent is working")).toBeTruthy();
    expect(screen.queryByText(/is planning/)).toBeNull();
  });

  it("renders the plan item and no phase group for entries with no phase", () => {
    pollQueue();
    mount(planSession([planEntry(1)]));

    expect(screen.getByRole("heading", { name: "Steps" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Planner" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reviewer" })).toBeNull();
  });

  describe("in a shared conversation", () => {
    const INVITE = {
      id: "invite_1",
      invitee_name: "Dana",
      expires_at: 1790000000000,
      projects: [],
    };
    const RUN_ANSWER = {
      kind: "run",
      session_id: SESSION_ID,
      agent_name: null,
      run_active: true,
      queued_message_id: null,
      cleared: [],
    } as const;

    function noteEntry(id: string, text: string): WorkbenchSessionEntry {
      return {
        session_id: SESSION_ID,
        agent_name: "swe@1",
        type: "custom",
        id,
        parentId: null,
        timestamp: "2026-10-05T09:00:00.000Z",
        customType: "kanthord.workbench.record",
        data: { kind: "note", text, author: { kind: "owner", name: "Ulrich" } },
      };
    }

    beforeEach(() => {
      vi.mocked(workbenchApi.listInvites).mockResolvedValue([INVITE]);
    });

    it("clears the composer on an untagged note and shows the note with no running item", async () => {
      const polls = pollQueue();
      vi.mocked(workbenchApi.sendWorkbenchMessage).mockResolvedValue({
        kind: "note",
        session_id: SESSION_ID,
      });
      mount(session());
      await screen.findByText("Note to everyone");

      await userEvent.type(screen.getByRole("combobox", { name: "Message" }), "Remember **this**");
      await userEvent.click(screen.getByRole("button", { name: "Send" }));
      await polls.answer({ entries: [noteEntry("e9", "Remember **this**")] });

      expect(await screen.findByText("Remember **this**")).toHaveClass("whitespace-pre-wrap");
      expect(screen.getByRole("combobox", { name: "Message" })).toHaveValue("");
      expect(screen.queryByRole("group", { name: "Run line" })).toBeNull();
      expect(screen.getByText("Idle")).toBeTruthy();
      expect(screen.queryByText("guest")).toBeNull();
    });

    it("reads the invite list again when a run answers an untagged send", async () => {
      pollQueue();
      vi.mocked(workbenchApi.sendWorkbenchMessage).mockResolvedValue(RUN_ANSWER);
      mount(session());
      await screen.findByText("Note to everyone");
      expect(workbenchApi.listInvites).toHaveBeenCalledTimes(1);

      await userEvent.type(screen.getByRole("combobox", { name: "Message" }), "hello");
      await userEvent.click(screen.getByRole("button", { name: "Send" }));

      await waitFor(() => expect(workbenchApi.listInvites).toHaveBeenCalledTimes(2));
    });

    it("reads the invite list only once for a tagged run", async () => {
      pollQueue();
      vi.mocked(workbenchApi.sendWorkbenchMessage).mockResolvedValue(RUN_ANSWER);
      mount(session());
      await screen.findByText("Note to everyone");

      await userEvent.type(screen.getByRole("combobox", { name: "Message" }), "@SWE hello");
      await userEvent.click(screen.getByRole("button", { name: "Send" }));

      expect(await screen.findByRole("group", { name: "Run line" })).toBeTruthy();
      expect(workbenchApi.listInvites).toHaveBeenCalledTimes(1);
    });

    it("reads the invite list again when a note answers an unshared conversation", async () => {
      pollQueue();
      vi.mocked(workbenchApi.listInvites).mockResolvedValueOnce([]).mockResolvedValue([INVITE]);
      vi.mocked(workbenchApi.sendWorkbenchMessage).mockResolvedValue({
        kind: "note",
        session_id: SESSION_ID,
      });
      mount(session());
      await waitFor(() => expect(workbenchApi.listInvites).toHaveBeenCalledTimes(1));

      await userEvent.type(screen.getByRole("combobox", { name: "Message" }), "hello");
      await userEvent.click(screen.getByRole("button", { name: "Send" }));

      expect(await screen.findByText("Note to everyone")).toBeTruthy();
      expect(workbenchApi.listInvites).toHaveBeenCalledTimes(2);
    });
  });

  describe("the Share button", () => {
    it("shows in the header of a session", async () => {
      pollQueue();
      vi.mocked(workbenchApi.listInvites).mockResolvedValue([]);
      mount(session());

      expect(await screen.findByRole("button", { name: "Share" })).toBeTruthy();
    });

    it("stays hidden on the new-session route", () => {
      render(
        <MemoryRouter>
          <NewSessionChat
            agentName="swe@1"
            agentDisplayName="SWE"
            configuration={ENABLEMENT.default_configuration}
          />
        </MemoryRouter>,
      );

      expect(screen.queryByRole("button", { name: "Share" })).toBeNull();
    });
  });
});
