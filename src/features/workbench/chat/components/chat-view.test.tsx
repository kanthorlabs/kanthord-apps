import type { ComponentProps } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as workbenchApi from "@/api/resources/workbench";
import * as workersApi from "@/api/resources/workers";
import type {
  AgentEnablement,
  WorkbenchRunSnapshot,
  WorkbenchSession,
  WorkbenchSessionEntry,
  WorkbenchSessionEvents,
} from "@/api/types";

vi.mock("@/api/resources/workbench");
vi.mock("@/api/resources/workers");

import { ChatView } from "./chat-view";

const SESSION_ID = "workbench_session_01J9ZQ4XKM3B6V8N2R5T7W0AB1";

const IDLE: WorkbenchRunSnapshot = {
  streaming_message: null,
  pending_tool_calls: [],
  pending_approval: null,
  queue: [],
  run_active: false,
  error_message: null,
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
    entries,
    run_active: runActive,
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
      entries?: WorkbenchSessionEvents["entries"];
      snapshot?: Partial<WorkbenchRunSnapshot>;
    }) {
      await waitFor(() => expect(waiting.length).toBeGreaterThan(0));
      waiting.shift()?.({
        entries: events.entries ?? [],
        snapshot: { ...IDLE, ...events.snapshot },
        version: ++version,
      });
    },
  };
}

function mount(
  held: WorkbenchSession,
  agentDisplayName = "SWE",
  slots: Partial<ComponentProps<typeof ChatView>> = {},
) {
  return render(
    <MemoryRouter>
      <ChatView
        session={held}
        enablement={ENABLEMENT}
        ownerName="Ulrich"
        agentDisplayName={agentDisplayName}
        {...slots}
      />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(workersApi.listAgentProviderModels).mockResolvedValue([
    { model_identifier: "qwen3-coder", reasoning_efforts: ["off"] },
  ]);
});

describe("ChatView", () => {
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
          tool_call_id: "call_2",
          operation_id: "project.create",
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

  it("renders the approval line in place of the approval card", async () => {
    const polls = pollQueue();
    mount(session([], true), "SWE", { approvalLine: <p>Queued as #1</p> });

    await polls.answer({
      snapshot: {
        run_active: true,
        pending_approval: { tool_call_id: "call_2", operation_id: "project.create", input: {} },
      },
    });

    expect(await screen.findByText("Queued as #1")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Approval Required" })).toBeNull();
  });

  it("renders the stream end after the stream and before the composer", async () => {
    pollQueue();
    mount(session([message("e1", { role: "user", content: "Hello" })]), "SWE", {
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
        pending_approval: { tool_call_id: "call_2", operation_id: "project.create", input: {} },
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
        pending_approval: { tool_call_id: "call_2", operation_id: "project.create", input: {} },
      },
    });
    await userEvent.click(await screen.findByRole("button", { name: "Approve" }));
    await screen.findByRole("alert");

    await polls.answer({
      snapshot: {
        run_active: true,
        pending_approval: { tool_call_id: "call_3", operation_id: "project.update", input: {} },
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
        pending_approval: { tool_call_id: "call_2", operation_id: "project.create", input: {} },
      },
    });
    await userEvent.click(await screen.findByRole("button", { name: "Reject" }));

    expect(workbenchApi.approveWorkbenchCall).toHaveBeenCalledWith(SESSION_ID, "call_2", false);
  });

  it("sends the message, clears the draft and starts the run state at once", async () => {
    pollQueue();
    vi.mocked(workbenchApi.sendWorkbenchMessage).mockResolvedValue({
      session_id: SESSION_ID,
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
        session_id: SESSION_ID,
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
        session_id: SESSION_ID,
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
        session_id: SESSION_ID,
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
        session_id: SESSION_ID,
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
        session_id: SESSION_ID,
        run_active: true,
        queued_message_id: null,
        cleared: [{ id: "queued_1", text: "queued one" }],
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
        pending_approval: { tool_call_id: "call_2", operation_id: "project.create", input: {} },
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
    mount(
      {
        ...session([
          message("e1", { role: "assistant", content: [{ type: "text", text: "Hello." }] }),
        ]),
        agent_name: "ops@1",
      },
      "Yumi",
    );

    expect(screen.getByText("Yumi")).toBeTruthy();
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
    expect(screen.getByText("SWE")).toBeTruthy();
    expect(screen.getAllByText(/UTC$/)).toHaveLength(1);
  });
});
