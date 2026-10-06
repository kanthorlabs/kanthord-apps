import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as workbenchApi from "@/api/resources/workbench";
import type {
  AgentEnablement,
  WorkbenchRunSnapshot,
  WorkbenchSession,
  WorkbenchSessionEntry,
  WorkbenchSessionEvents,
} from "@/api/types";

vi.mock("@/api/resources/workbench");

import { ChatView } from "./chat-view";

const SESSION_ID = "workbench_session_01J9ZQ4XKM3B6V8N2R5T7W0AB1";

const IDLE: WorkbenchRunSnapshot = {
  streamingMessage: null,
  pendingToolCalls: [],
  pendingApproval: null,
  runActive: false,
  errorMessage: null,
};

const ENABLEMENT: AgentEnablement = {
  agentName: "swe@1",
  state: "enabled",
  agentProviders: [{ name: "atlas-llm", provider: "openai-compatible", credential: "atlas-main" }],
  defaultConfiguration: {
    agentProvider: "atlas-llm",
    modelIdentifier: "qwen3-coder",
    reasoningEffort: "off",
  },
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
    agentName: "swe@1",
    configuration: ENABLEMENT.defaultConfiguration,
    entries,
    runActive,
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

function mount(held: WorkbenchSession) {
  return render(<ChatView session={held} enablement={ENABLEMENT} />);
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("ChatView", () => {
  it("renders user messages, assistant text, tool calls and tool results", () => {
    pollQueue();
    mount(
      session([
        message("e1", { role: "user", content: "List the open objectives" }),
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
    expect(within(log).getByText("List the open objectives")).toBeTruthy();
    expect(within(log).getByText("I read the mission first.")).toBeTruthy();
    expect(within(log).getByRole("button", { name: "Tool Call mission.node.list" })).toBeTruthy();
    expect(within(log).getByRole("button", { name: "Tool Result mission.node.list" })).toBeTruthy();
    expect(within(log).getByText("Nothing is open.")).toBeTruthy();
  });

  it("expands a tool call to show its whole input", async () => {
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
      await screen.findByText('{\n  "path": "a.md"\n}', { normalizer: (text) => text }),
    ).toBeTruthy();
  });

  it("shows the idle state and the empty transcript of a new session", () => {
    pollQueue();
    mount(session());

    expect(screen.getByText("Idle")).toBeTruthy();
    expect(screen.getByText("No messages. Write the first one below.")).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Message" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();
  });

  it("renders the streaming partial message and the entries that arrive", async () => {
    const polls = pollQueue();
    mount(session([message("e1", { role: "user", content: "Hi" })], true));

    await polls.answer({
      snapshot: {
        runActive: true,
        streamingMessage: { role: "assistant", content: [{ type: "text", text: "Hel" }] },
      },
    });
    expect(await screen.findByText("Hel")).toBeTruthy();
    expect(screen.getByText("Streaming")).toBeTruthy();

    await polls.answer({
      entries: [message("e2", { role: "assistant", content: [{ type: "text", text: "Hello" }] })],
      snapshot: { runActive: false },
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

  it("disables sending and offers Stop while a run is active", async () => {
    const polls = pollQueue();
    vi.mocked(workbenchApi.abortWorkbenchRun).mockResolvedValue({
      sessionId: SESSION_ID,
      runActive: false,
    });
    mount(session([], true));
    await polls.answer({ snapshot: { runActive: true } });

    expect(await screen.findByText("Running")).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Message" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Stop" }));

    expect(workbenchApi.abortWorkbenchRun).toHaveBeenCalledWith(SESSION_ID);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Stop" })).toBeNull());
    expect(screen.getByRole("textbox", { name: "Message" })).toBeEnabled();
  });

  it("shows the error message of a failed run", async () => {
    const polls = pollQueue();
    mount(session());

    await polls.answer({ snapshot: { errorMessage: "The model provider refused the request." } });

    expect(await screen.findByText("The model provider refused the request.")).toBeTruthy();
  });

  it("shows the operation and the input of a pending approval and approves it", async () => {
    const polls = pollQueue();
    vi.mocked(workbenchApi.approveWorkbenchCall).mockResolvedValue({
      sessionId: SESSION_ID,
      toolCallId: "call_2",
      approved: true,
    });
    mount(session([], true));

    await polls.answer({
      snapshot: {
        runActive: true,
        pendingApproval: {
          toolCallId: "call_2",
          operationId: "project.create",
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

  it("rejects a pending approval", async () => {
    const polls = pollQueue();
    vi.mocked(workbenchApi.approveWorkbenchCall).mockResolvedValue({
      sessionId: SESSION_ID,
      toolCallId: "call_2",
      approved: false,
    });
    mount(session([], true));

    await polls.answer({
      snapshot: {
        runActive: true,
        pendingApproval: { toolCallId: "call_2", operationId: "project.create", input: {} },
      },
    });
    await userEvent.click(await screen.findByRole("button", { name: "Reject" }));

    expect(workbenchApi.approveWorkbenchCall).toHaveBeenCalledWith(SESSION_ID, "call_2", false);
  });

  it("sends the message, clears the draft and starts the run state at once", async () => {
    pollQueue();
    vi.mocked(workbenchApi.sendWorkbenchMessage).mockResolvedValue({
      sessionId: SESSION_ID,
      runActive: true,
    });
    mount(session());

    await userEvent.type(screen.getByRole("textbox", { name: "Message" }), "List the objectives");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(workbenchApi.sendWorkbenchMessage).toHaveBeenCalledWith(
      SESSION_ID,
      "List the objectives",
    );
    expect(await screen.findByText("Running")).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue("");
  });

  it("keeps the draft and names the refusal when the send fails", async () => {
    pollQueue();
    vi.mocked(workbenchApi.sendWorkbenchMessage).mockRejectedValue(
      new ApiError("conflict", "The workbench session holds an active run.", 409),
    );
    mount(session());

    await userEvent.type(screen.getByRole("textbox", { name: "Message" }), "again");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("The workbench session holds an active run.")).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue("again");
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
});
