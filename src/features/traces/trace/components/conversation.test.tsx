import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";

vi.mock("@/api/resources/tracking", () => ({
  listSessionEntryPage: vi.fn(),
}));

import { listSessionEntryPage } from "@/api/resources/tracking";
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

function pinned(part: string, text: string, index?: number): Record<string, unknown> {
  return { type: "custom", customType: "kanthord.pinned_context", data: { part, text, index } };
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
  entry("pin-prompt", 1, pinned("system_prompt", "You are a coder.")),
  entry("pin-layer", 2, pinned("layer", "Follow the repository rules.", 2)),
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

function Harness({ spans, live = false }: { spans: readonly TraceSpan[]; live?: boolean }) {
  const selection = useTraceSelection(spans);
  const location = useLocation();
  return (
    <>
      <Conversation traceId="trace-1" spans={spans} live={live} selection={selection} />
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
    expect(blocks[3]).toHaveTextContent("List the files.");
    expect(blocks[4]).toHaveTextContent("I will list the files.");
  });

  it("shows the pinned context and the pi system message collapsed behind Show prompt", async () => {
    mockEntries(ENTRIES);
    show([SESSION_1, TURN]);
    await screen.findByText("List the files.");

    const prompt = blockOf("System prompt");
    expect(prompt).toHaveTextContent("16 characters");
    expect(screen.queryByText("You are a coder.")).not.toBeInTheDocument();
    await userEvent.click(within(prompt).getByRole("button", { name: "Show prompt" }));
    expect(await screen.findByText("You are a coder.")).toBeInTheDocument();

    const layer = blockOf("Layer 2");
    expect(layer).toHaveTextContent("28 characters");
    await userEvent.click(within(layer).getByRole("button", { name: "Show prompt" }));
    expect(await screen.findByText("Follow the repository rules.")).toBeInTheDocument();

    const update = blockOf("System prompt update");
    expect(update).toHaveTextContent("15 characters");
    await userEvent.click(within(update).getByRole("button", { name: "Show prompt" }));
    expect(await screen.findByText("Updated prompt.")).toBeInTheDocument();
    expect(screen.getByText("rules")).toBeInTheDocument();
    expect(screen.getByText("Be brief.")).toBeInTheDocument();
  });

  it("shows the user message and the model reply with thinking, calls and usage", async () => {
    mockEntries(ENTRIES);
    show([SESSION_1, TURN]);
    await screen.findByText("List the files.");

    const user = blockOf("User");
    expect(user).toHaveTextContent("List the files.");

    const reply = blockOf("Model");
    expect(within(reply).getByText("I will list the files.")).toBeInTheDocument();
    expect(within(reply).getByText("1.2k in · 600 out · Est. cost $0.0600")).toBeInTheDocument();
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

  it("selects the turn span on the Timeline tab with Show in timeline", async () => {
    mockEntries(ENTRIES);
    show([SESSION_1, TURN]);
    await screen.findByText("List the files.");

    expect(screen.getAllByRole("button", { name: "Show in timeline" })).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Show in timeline" }));

    const search = new URLSearchParams(screen.getByRole("status").textContent ?? "");
    expect(search.get("tab")).toBe("timeline");
    expect(search.get("span")).toBe("turn-1");
  });

  it("offers no Show in timeline without a turn span", async () => {
    mockEntries(ENTRIES);
    show([SESSION_1]);
    await screen.findByText("List the files.");

    expect(screen.queryByRole("button", { name: "Show in timeline" })).not.toBeInTheDocument();
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
      .mockResolvedValueOnce({ items: [ENTRIES[3] as TraceSessionEntry], next_cursor: "c1" })
      .mockRejectedValueOnce(new ApiError("unavailable", "Daemon down.", 503))
      .mockResolvedValueOnce({ items: [ENTRIES[3] as TraceSessionEntry], next_cursor: "c1" })
      .mockResolvedValueOnce({ items: [ENTRIES[7] as TraceSessionEntry], next_cursor: null });
    show([SESSION_1]);

    expect(await screen.findByText("Daemon down.")).toBeInTheDocument();
    expect(screen.getByText("List the files.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("label")).toBeInTheDocument();
    expect(screen.queryByText("Daemon down.")).not.toBeInTheDocument();
    expect(screen.getAllByText("List the files.")).toHaveLength(1);
  });
});
