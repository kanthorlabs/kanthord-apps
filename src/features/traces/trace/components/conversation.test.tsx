import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";

vi.mock("@/api/resources/tracking", () => ({
  listSessionEntryPage: vi.fn(),
  rebuildSessionEntry: vi.fn(),
}));
vi.mock("@/api/resources/workers", () => ({
  resolveAgentPrompt: vi.fn(),
}));

import { listSessionEntryPage, rebuildSessionEntry } from "@/api/resources/tracking";
import { resolveAgentPrompt } from "@/api/resources/workers";
import type { TraceSessionEntry, TraceSpan } from "@/api/types";
import { utcDateTime } from "@/lib/format";

import { useTraceSelection } from "../use-trace-selection";
import { Conversation } from "./conversation";

const START = Date.UTC(2026, 4, 2, 10, 30);

function span(
  id: string,
  operation: string,
  attributes: TraceSpan["attributes"] = {},
  overrides: Partial<TraceSpan> = {},
): TraceSpan {
  return {
    trace_id: "trace-1",
    span_id: id,
    parent_span_id: null,
    producer: "worker",
    origin: "observed",
    operation,
    start_time: START,
    end_time: START + 1000,
    status: "Ok",
    attributes,
    events: [],
    links: [],
    text_ids: [],
    created_at: START,
    ...overrides,
  };
}

function entry(
  id: string,
  sequence: number,
  raw: Record<string, unknown>,
  overrides: Partial<TraceSessionEntry> = {},
): TraceSessionEntry {
  return {
    trace_id: "trace-1",
    session_id: "session-1",
    entry_id: id,
    parent_entry_id: null,
    sequence,
    entry_type: String(raw.type),
    entry_time: START,
    tool_call_id: null,
    truncated: false,
    entry: raw,
    created_at: START,
    ...overrides,
  };
}

function message(role: string, fields: Record<string, unknown>): Record<string, unknown> {
  return { type: "message", message: { role, ...fields } };
}

function pinned(part: string): Record<string, unknown> {
  return { type: "custom", customType: "kanthord.pinned_context", data: { part } };
}

const SESSION_1 = span("session-1", "agent.session", { "kanthord.agent.name": "coder" });
const SESSION_2 = span(
  "session-2",
  "agent.session",
  { "kanthord.agent.name": "reviewer" },
  { start_time: START + 60_000 },
);
const TURN = span("turn-1", "agent.turn", {
  "gen_ai.conversation.id": "session-1",
  "kanthord.session.entry_id": "reply",
});

const ENTRIES: readonly TraceSessionEntry[] = [
  entry("pin-prompt", 1, pinned("system_prompt")),
  entry(
    "pi-system",
    3,
    message("system", {
      content: "Updated prompt.",
      sections: { rules: "Be brief." },
    }),
  ),
  entry("ask", 4, message("user", { content: "List the files." })),
  entry(
    "reply",
    5,
    message("assistant", {
      content: [
        { type: "text", text: "I will list the files." },
        { type: "thinking", thinking: "Plan the listing." },
        { type: "toolCall", id: "call-1", name: "bash", arguments: { command: "ls" } },
        { type: "toolCall", id: "call-2", name: "read", arguments: { path: "a.txt" } },
      ],
      usage: { input: 1200, output: 600, cost: { total: 0.06 } },
    }),
  ),
  entry(
    "result",
    6,
    message("toolResult", {
      toolCallId: "call-1",
      toolName: "bash",
      isError: true,
      content: [{ type: "text", text: "boom\nsecond line" }],
    }),
  ),
  entry("switch", 7, { type: "model_change", modelId: "claude-b" }),
  entry("tag", 8, { type: "label" }),
];

const TASK = span("task-1", "worker.task");
const TASK_TURN = span(
  "turn-1",
  "agent.turn",
  { "gen_ai.conversation.id": "session-1", "kanthord.session.entry_id": "reply" },
  { parent_span_id: "task-1" },
);
const FAILED_TURN = { ...TASK_TURN, status: "Error" } satisfies TraceSpan;
const FAILED_TOOL = span(
  "tool-1",
  "agent.tool",
  { "gen_ai.tool.call.id": "call-1" },
  { parent_span_id: "task-1", status: "Error" },
);
const ENTRIES_WITH_CALL: readonly TraceSessionEntry[] = ENTRIES.map((item) =>
  item.entry_id === "result" ? { ...item, tool_call_id: "call-1" } : item,
);

function Harness({ spans, live = false }: { spans: readonly TraceSpan[]; live?: boolean }) {
  const selection = useTraceSelection(spans);
  const location = useLocation();
  return (
    <>
      <Conversation
        traceId="trace-1"
        executionId="exec-1"
        spans={spans}
        live={live}
        selection={selection}
      />
      <output>{location.search}</output>
    </>
  );
}

function show(spans: readonly TraceSpan[], url = "/traces/trace-1?tab=conversation") {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Harness spans={spans} />
    </MemoryRouter>,
  );
}

function mockEntries(entries: readonly TraceSessionEntry[]) {
  vi.mocked(listSessionEntryPage).mockResolvedValue({ items: entries, next_cursor: null });
}

function blockOf(label: string): HTMLElement {
  const block = screen
    .getByText(label, { selector: "[data-slot=item-title]" })
    .closest("[role=listitem]");
  if (!(block instanceof HTMLElement)) throw new Error(`No block ${label}`);
  return block;
}

const CUT_ENTRY = entry("ask", 1, message("user", { content: "Long." }), { truncated: true });
const FULL_ENTRY = entry("ask", 1, message("user", { content: "Long. And the rest of it." }));

function rebuildFailure(
  status: number,
  detail: string,
  details: Record<string, unknown>,
): ApiError {
  return new ApiError(
    status === 409 ? "conflict" : "unavailable",
    "Refused.",
    status,
    detail,
    details,
  );
}

const SERVER = { instance: "local", placement: "server" };
const WORKER = { instance: "laptop", placement: "worker" };

const REBUILD_FAILURES: readonly (readonly [string, ApiError, string])[] = [
  [
    "unreachable offline",
    rebuildFailure(503, "tracking.entry.unreachable", { ...WORKER, reason: "offline" }),
    "The worker instance laptop holds no connection. KanthorD reads its sessions only while it runs. Start it, then try again.",
  ],
  [
    "unreachable timeout",
    rebuildFailure(503, "tracking.entry.unreachable", { ...WORKER, reason: "timeout" }),
    "The worker instance laptop did not answer within 25 s. A large entry over a slow link cannot finish in time.",
  ],
  [
    "unreachable busy",
    rebuildFailure(503, "tracking.entry.unreachable", { ...WORKER, reason: "busy" }),
    "The worker instance laptop serves 8 reads now. Try again.",
  ],
  [
    "unreadable",
    rebuildFailure(503, "tracking.entry.unreadable", SERVER),
    "KanthorD could not read the session file of local. Try again.",
  ],
  [
    "too_large",
    rebuildFailure(409, "tracking.entry.too_large", {
      ...SERVER,
      bytes: 40_000_000,
      limit: 33_488_896,
    }),
    "The full entry holds 38.1 MiB. KanthorD rebuilds an entry of at most 31.9 MiB.",
  ],
  [
    "session_absent not_kept",
    rebuildFailure(404, "tracking.entry.session_absent", { ...SERVER, reason: "not_kept" }),
    "The host of local holds no file of this session.",
  ],
  [
    "session_absent archived",
    rebuildFailure(404, "tracking.entry.session_absent", { ...WORKER, reason: "archived" }),
    "The worker instance laptop is archived. KanthorD no longer reads its sessions.",
  ],
  [
    "session_absent instance_unknown",
    rebuildFailure(404, "tracking.entry.session_absent", {
      instance: null,
      placement: null,
      reason: "instance_unknown",
    }),
    "No worker instance of KanthorD ran this session.",
  ],
  [
    "entry_absent",
    rebuildFailure(404, "tracking.entry.entry_absent", SERVER),
    "The session file on local holds no entry with this identity.",
  ],
];

afterEach(() => {
  vi.resetAllMocks();
});

describe("Conversation", () => {
  it("shows a notice when the trace holds no agent session", () => {
    show([TURN]);

    expect(screen.getByText("This trace holds no agent session.")).toBeInTheDocument();
    expect(listSessionEntryPage).not.toHaveBeenCalled();
  });

  it("shows a skeleton while the entries load, then the entries in order", async () => {
    mockEntries(ENTRIES);
    show([SESSION_1, TURN]);

    expect(screen.getByRole("status", { name: "Loading entries" })).toBeInTheDocument();
    expect(await screen.findByText("List the files.")).toBeInTheDocument();
    expect(listSessionEntryPage).toHaveBeenCalledWith("trace-1", "session-1", null, 100);
    const entries = screen.getByRole("list", { name: "Entries" });
    const blocks = within(entries)
      .getAllByRole("listitem")
      .filter((block) => block.parentElement === entries);
    expect(blocks).toHaveLength(ENTRIES.length);
    expect(blocks[2]).toHaveTextContent("List the files.");
    expect(blocks[3]).toHaveTextContent("I will list the files.");
  });

  it("expands the pinned marker through the resolve read and the pi system message in place", async () => {
    mockEntries(ENTRIES);
    vi.mocked(resolveAgentPrompt).mockResolvedValue({
      parts: [],
      final: "You are a coder.",
      engine_version: "0.4.0",
    });
    show([SESSION_1, TURN]);
    await screen.findByText("List the files.");

    const prompt = blockOf("System prompt");
    expect(resolveAgentPrompt).not.toHaveBeenCalled();
    await userEvent.click(within(prompt).getByRole("button", { name: "Show prompt" }));
    expect(await screen.findByText("You are a coder.")).toBeInTheDocument();
    expect(prompt).toHaveTextContent("16 characters");
    expect(resolveAgentPrompt).toHaveBeenCalledWith("exec-1", "coder");

    const update = blockOf("System prompt update");
    expect(update).toHaveTextContent("15 characters");
    await userEvent.click(within(update).getByRole("button", { name: "Show prompt" }));
    expect(await screen.findByText("Updated prompt.")).toBeInTheDocument();
    expect(screen.getByText("rules")).toBeInTheDocument();
    expect(screen.getByText("Be brief.")).toBeInTheDocument();
  });

  it("states a pinned marker whose system prompt does not resolve", async () => {
    mockEntries(ENTRIES);
    vi.mocked(resolveAgentPrompt).mockResolvedValue({
      parts: [],
      final: null,
      engine_version: "0.4.0",
    });
    show([SESSION_1, TURN]);
    await screen.findByText("List the files.");

    await userEvent.click(
      within(blockOf("System prompt")).getByRole("button", { name: "Show prompt" }),
    );

    expect(await screen.findByText(/A part of this system prompt does not resolve/)).toBeTruthy();
  });

  it("shows the user message and the model reply with thinking, calls and usage", async () => {
    mockEntries(ENTRIES);
    show([SESSION_1, TURN]);
    await screen.findByText("List the files.");

    const user = blockOf("User");
    expect(user).toHaveTextContent("List the files.");

    const reply = blockOf("Model");
    expect(within(reply).getByText("I will list the files.")).toBeInTheDocument();
    expect(within(reply).getByText("1.2k in · 600 out · API price $0.0600")).toBeInTheDocument();
    expect(within(reply).getByText("bash")).toBeInTheDocument();
    expect(within(reply).getByText("read")).toBeInTheDocument();
    expect(within(reply).queryByText("Plan the listing.")).not.toBeInTheDocument();
    await userEvent.click(within(reply).getByRole("button", { name: "Show thinking" }));
    expect(await within(reply).findByText("Plan the listing.")).toBeInTheDocument();

    const toggles = within(reply).getAllByRole("button", { name: "Show arguments" });
    expect(toggles).toHaveLength(2);
    expect(within(reply).queryByText(/"command"/)).not.toBeInTheDocument();
    await userEvent.click(toggles[0] as HTMLElement);
    expect((await within(reply).findByText(/"command"/)).textContent).toBe(
      '{\n  "command": "ls"\n}',
    );
  });

  it("shows the tool outcome, the first line and the full result on request", async () => {
    mockEntries(ENTRIES);
    show([SESSION_1, TURN]);
    await screen.findByText("List the files.");

    const result = screen.getByText("boom").closest("[role=listitem]") as HTMLElement;
    expect(within(result).getByText("Error")).toBeInTheDocument();
    expect(within(result).getByText("boom")).toBeInTheDocument();
    expect(within(result).queryByText(/second line/)).not.toBeInTheDocument();
    await userEvent.click(within(result).getByRole("button", { name: "Show result" }));
    expect((await within(result).findByText(/second line/)).textContent).toBe("boom\nsecond line");
  });

  it("shows the model change and the type of an unknown entry", async () => {
    mockEntries(ENTRIES);
    show([SESSION_1, TURN]);

    expect(await screen.findByText("Model changed to claude-b")).toBeInTheDocument();
    expect(screen.getByText("label")).toBeInTheDocument();
  });

  it("marks a cut entry with the Cut badge and its tooltip", async () => {
    mockEntries([entry("ask", 1, message("user", { content: "Long." }), { truncated: true })]);
    show([SESSION_1]);

    const badge = await screen.findByText("Cut");
    await userEvent.click(badge);

    expect(
      await screen.findByText(
        "The worker cut this entry to fit the entry bound of 60 KiB.",
        undefined,
        { timeout: 2000 },
      ),
    ).toBeInTheDocument();
  });

  it("offers Load full entry only on a cut entry", async () => {
    mockEntries([CUT_ENTRY, entry("reply", 2, message("user", { content: "Short." }))]);
    show([SESSION_1]);
    await screen.findByText("Short.");

    expect(screen.getAllByRole("button", { name: "Load full entry" })).toHaveLength(1);
    expect(
      within(screen.getByText("Long.").closest("[role=listitem]") as HTMLElement).getByRole(
        "button",
        { name: "Load full entry" },
      ),
    ).toBeInTheDocument();
  });

  it("loads the full entry in place of the cut copy and marks it Full", async () => {
    mockEntries([CUT_ENTRY]);
    let answer: (entry: TraceSessionEntry) => void = () => undefined;
    vi.mocked(rebuildSessionEntry).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    show([SESSION_1]);
    await screen.findByText("Long.");

    await userEvent.click(screen.getByRole("button", { name: "Load full entry" }));
    expect(screen.getByRole("button", { name: "Load full entry" })).toBeDisabled();
    expect(rebuildSessionEntry).toHaveBeenCalledWith("trace-1", "session-1", "ask");
    answer(FULL_ENTRY);

    expect(await screen.findByText("Long. And the rest of it.")).toBeInTheDocument();
    expect(screen.queryByText("Long.")).not.toBeInTheDocument();
    expect(screen.getByText("Full")).toBeInTheDocument();
    expect(screen.queryByText("Cut")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load full entry" })).not.toBeInTheDocument();
  });

  it.each(REBUILD_FAILURES)(
    "states the %s failure and keeps the cut copy",
    async (_name, failure, text) => {
      mockEntries([CUT_ENTRY]);
      vi.mocked(rebuildSessionEntry).mockRejectedValue(failure);
      show([SESSION_1]);
      await screen.findByText("Long.");

      await userEvent.click(screen.getByRole("button", { name: "Load full entry" }));

      const block = screen.getByText("Long.").closest("[role=listitem]") as HTMLElement;
      expect((await within(block).findByRole("alert")).textContent).toBe(text);
      expect(within(block).getByText("Cut")).toBeInTheDocument();
      expect(within(block).getByRole("button", { name: "Load full entry" })).toBeEnabled();
    },
  );

  it("states a timeout with no Try again", async () => {
    mockEntries([CUT_ENTRY]);
    vi.mocked(rebuildSessionEntry).mockRejectedValue(
      rebuildFailure(503, "tracking.entry.unreachable", { ...WORKER, reason: "timeout" }),
    );
    show([SESSION_1]);
    await screen.findByText("Long.");

    await userEvent.click(screen.getByRole("button", { name: "Load full entry" }));

    expect(await screen.findByRole("alert")).not.toHaveTextContent("Try again.");
  });

  it("names the instance of a failure as a record name", async () => {
    mockEntries([CUT_ENTRY]);
    vi.mocked(rebuildSessionEntry).mockRejectedValue(
      rebuildFailure(503, "tracking.entry.unreachable", { ...WORKER, reason: "offline" }),
    );
    show([SESSION_1]);
    await screen.findByText("Long.");

    await userEvent.click(screen.getByRole("button", { name: "Load full entry" }));

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("laptop").tagName).toBe("STRONG");
  });

  it("shows no Session select for one session", async () => {
    mockEntries(ENTRIES);
    show([SESSION_1]);
    await screen.findByText("List the files.");

    expect(screen.queryByRole("combobox", { name: "Session" })).not.toBeInTheDocument();
  });

  it("reads the other session after a choice in the Session select", async () => {
    vi.mocked(listSessionEntryPage).mockImplementation(async (_trace, sessionId) => ({
      items: [
        entry("ask", 1, message("user", { content: `Hello ${sessionId}.` }), {
          session_id: sessionId,
        }),
      ],
      next_cursor: null,
    }));
    show([SESSION_2, SESSION_1]);

    expect(await screen.findByText("Hello session-1.")).toBeInTheDocument();
    const select = screen.getByRole("combobox", { name: "Session" });
    expect(select).toHaveTextContent(`coder · ${utcDateTime(START)}`);
    await userEvent.click(select);
    await userEvent.click(
      await screen.findByRole("option", { name: `reviewer · ${utcDateTime(START + 60_000)}` }),
    );

    expect(await screen.findByText("Hello session-2.")).toBeInTheDocument();
    expect(screen.queryByText("Hello session-1.")).not.toBeInTheDocument();
    expect(listSessionEntryPage).toHaveBeenLastCalledWith("trace-1", "session-2", null, 100);
    expect(screen.getByRole("status")).toHaveTextContent("session=session-2");
  });

  it("labels the system prompt and each work prompt and collapses them", async () => {
    mockEntries(ENTRIES);
    show([TASK, SESSION_1, TASK_TURN]);
    await screen.findByText("Work prompt task-1");

    const system = blockOf("System prompt");
    expect(within(system).getByRole("button", { name: "Show prompt" })).toBeInTheDocument();
    expect(screen.queryByText("You are a coder.")).not.toBeInTheDocument();
    const work = blockOf("Work prompt task-1");
    expect(screen.queryByText("List the files.")).not.toBeInTheDocument();
    await userEvent.click(within(work).getByRole("button", { name: "Show prompt" }));
    expect(await screen.findByText("List the files.")).toBeInTheDocument();
    expect(screen.queryByText("User", { selector: "[data-slot=item-title]" })).toBeNull();
  });

  it("selects the turn span on the Steps tab with Show in steps", async () => {
    mockEntries(ENTRIES);
    show([SESSION_1, TURN]);
    await screen.findByText("List the files.");

    expect(screen.getAllByRole("button", { name: "Show in steps" })).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Show in steps" }));

    const search = new URLSearchParams(screen.getByRole("status").textContent ?? "");
    expect(search.get("tab")).toBe("steps");
    expect(search.get("span")).toBe("turn-1");
  });

  it("offers no Show in steps without a turn span", async () => {
    mockEntries(ENTRIES);
    show([SESSION_1]);
    await screen.findByText("List the files.");

    expect(screen.queryByRole("button", { name: "Show in steps" })).not.toBeInTheDocument();
  });

  it("jumps to the reply entry of a causal turn", async () => {
    mockEntries(ENTRIES);
    show([TASK, SESSION_1, FAILED_TURN]);
    await screen.findByText("I will list the files.");

    await userEvent.click(screen.getByRole("button", { name: "Jump to the causal entry" }));

    const search = new URLSearchParams(screen.getByRole("status").textContent ?? "");
    expect(search.get("entry")).toBe("reply");
    const marked = screen.getAllByRole("listitem").filter((block) => block.ariaCurrent === "true");
    expect(marked).toHaveLength(1);
    expect(marked[0]).toHaveTextContent("I will list the files.");
  });

  it("jumps to the result entry of a causal tool", async () => {
    mockEntries(ENTRIES_WITH_CALL);
    show([TASK, SESSION_1, FAILED_TOOL]);
    await screen.findByText("I will list the files.");

    await userEvent.click(screen.getByRole("button", { name: "Jump to the causal entry" }));

    const search = new URLSearchParams(screen.getByRole("status").textContent ?? "");
    expect(search.get("entry")).toBe("result");
  });

  it("hides the jump when the causal span has no entry", async () => {
    mockEntries(ENTRIES);
    show([TASK, SESSION_1, FAILED_TOOL]);
    await screen.findByText("I will list the files.");

    expect(
      screen.queryByRole("button", { name: "Jump to the causal entry" }),
    ).not.toBeInTheDocument();
  });

  it("renders a long token inside blocks with min-w-0", async () => {
    const token = "x".repeat(400);
    mockEntries([entry("ask", 1, message("user", { content: token }))]);
    show([SESSION_1]);

    const text = await screen.findByText(token);
    expect(text).toHaveClass("min-w-0", "break-words");
    expect(text.parentElement).toHaveClass("min-w-0");
    expect(blockOf("User")).toHaveClass("min-w-0");
  });

  it("marks and scrolls to the entry of the entry query key", async () => {
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    mockEntries(ENTRIES);
    show([SESSION_1, TURN], "/traces/trace-1?tab=conversation&entry=ask");
    await screen.findByText("List the files.");

    const marked = screen.getAllByRole("listitem").filter((block) => block.ariaCurrent === "true");
    expect(marked).toHaveLength(1);
    expect(marked[0]).toHaveTextContent("List the files.");
    await waitFor(() => expect(scroll).toHaveBeenCalledTimes(1));
    scroll.mockRestore();
  });

  it("keeps the entries and offers Retry after a failed read", async () => {
    vi.mocked(listSessionEntryPage)
      .mockResolvedValueOnce({ items: [ENTRIES[2] as TraceSessionEntry], next_cursor: "c1" })
      .mockRejectedValueOnce(new ApiError("unavailable", "Daemon down.", 503))
      .mockResolvedValueOnce({ items: [ENTRIES[2] as TraceSessionEntry], next_cursor: "c1" })
      .mockResolvedValueOnce({ items: [ENTRIES[6] as TraceSessionEntry], next_cursor: null });
    show([SESSION_1]);

    expect(await screen.findByText("Daemon down.")).toBeInTheDocument();
    expect(screen.getByText("List the files.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("label")).toBeInTheDocument();
    expect(screen.queryByText("Daemon down.")).not.toBeInTheDocument();
    expect(screen.getAllByText("List the files.")).toHaveLength(1);
  });
});
