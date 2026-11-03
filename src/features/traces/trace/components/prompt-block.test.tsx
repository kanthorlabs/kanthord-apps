import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/resources/tracking", () => ({
  listSessionEntryPage: vi.fn(),
}));
vi.mock("@/api/resources/workers", () => ({
  resolveAgentPrompt: vi.fn(),
}));

import { listSessionEntryPage } from "@/api/resources/tracking";
import { resolveAgentPrompt } from "@/api/resources/workers";
import type {
  PromptPart,
  PromptResolveAnswer,
  SpanAttributeValue,
  TraceSessionEntry,
  TraceSpan,
} from "@/api/types";

import type { TraceSelection } from "../use-trace-selection";
import { PromptBlock } from "./prompt-block";

function span(
  id: string,
  operation: string,
  attributes: Readonly<Record<string, SpanAttributeValue>> = {},
  overrides: Partial<TraceSpan> = {},
): TraceSpan {
  return {
    trace_id: "trace-1",
    span_id: id,
    parent_span_id: null,
    producer: "worker",
    origin: "observed",
    operation,
    start_time: 1000,
    end_time: 2000,
    status: "Ok",
    attributes,
    events: [],
    links: [],
    text_ids: [],
    created_at: 1000,
    ...overrides,
  };
}

function entry(id: string, sequence: number, raw: Record<string, unknown>): TraceSessionEntry {
  return {
    trace_id: "trace-1",
    session_id: "session-1",
    entry_id: id,
    parent_entry_id: null,
    sequence,
    entry_type: String(raw.type),
    entry_time: 1000,
    tool_call_id: null,
    truncated: false,
    entry: raw,
    created_at: 1000,
  };
}

function message(role: string, text: string): Record<string, unknown> {
  return { type: "message", message: { role, content: [{ type: "text", text }] } };
}

const ENTRIES = [
  entry("pinned", 1, {
    type: "custom",
    customType: "kanthord.pinned_context",
    data: { part: "system_prompt" },
  }),
  entry("work-1", 2, message("user", "Do task one now")),
  entry("reply-1", 3, message("assistant", "ok")),
];

function part(overrides: Partial<PromptPart>): PromptPart {
  return {
    layer: 1,
    part: "standard",
    name: "base.md",
    origin: "binary",
    path: "/data/agents/base.md",
    binding_id: null,
    commit: null,
    digest: "a".repeat(64),
    heading: null,
    state: "resolved",
    text: "Shared standard.",
    ...overrides,
  };
}

const COMMIT = "c".repeat(40);
const FILE = part({
  layer: 2,
  part: "instruction_file",
  name: "apps",
  origin: "repository",
  path: "AGENTS.md",
  binding_id: "binding-1",
  commit: COMMIT,
  digest: "b".repeat(64),
  heading: "Repository prompt of repository apps, file AGENTS.md:",
  text: "Line one.\nLine two.",
});

const ANSWER: PromptResolveAnswer = {
  parts: [part({}), FILE],
  final: "You are a coder.",
  engine_version: "0.4.0",
};

const SPANS = [
  span("session-1", "agent.session", { "kanthord.agent.name": "coder" }),
  span("prompt", "agent.prompt", { "kanthord.agent.name": "coder" }),
  span("task-1", "worker.task", { "kanthord.task.id": "T1" }),
  span(
    "turn-1",
    "agent.turn",
    {
      "kanthord.prompt.template": "work",
      "gen_ai.conversation.id": "session-1",
      "kanthord.session.entry_id": "reply-1",
    },
    { parent_span_id: "task-1" },
  ),
];

function selectionOf(
  openInConversation: (sessionId: string, entryId: string) => void = vi.fn(),
): TraceSelection {
  return { openInConversation } as unknown as TraceSelection;
}

afterEach(() => {
  vi.resetAllMocks();
});

function mockReads(answer: PromptResolveAnswer = ANSWER) {
  vi.mocked(listSessionEntryPage).mockResolvedValue({ items: ENTRIES, next_cursor: null });
  vi.mocked(resolveAgentPrompt).mockImplementation(async (executionId) =>
    executionId === "exec-0"
      ? { ...answer, parts: [part({}), { ...FILE, text: "Line one.\nOld line." }] }
      : answer,
  );
}

function block(
  spans: readonly TraceSpan[] = SPANS,
  options: { open?: (sessionId: string, entryId: string) => void; changed?: boolean } = {},
) {
  render(
    <PromptBlock
      traceId="trace-1"
      executionId="exec-1"
      spans={spans}
      selection={selectionOf(options.open)}
      diffBase={
        options.changed === true
          ? {
              executionId: "exec-0",
              changed: new Map([["coder", new Set(["instruction_file:apps"])]]),
            }
          : null
      }
    />,
  );
}

describe("PromptBlock", () => {
  it("shows the system prompt, the parts and the work prompt of each task", async () => {
    mockReads();

    block();

    expect(await screen.findByText("System prompt 16 chars")).toBeInTheDocument();
    const parts = within(screen.getByRole("list", { name: "Prompt parts of coder" }));
    expect(parts.getByText("standard base.md")).toBeInTheDocument();
    expect(parts.getByText("instruction_file apps")).toBeInTheDocument();
    expect(screen.getByText("Work prompt T1 15 chars")).toBeInTheDocument();
    expect(screen.getByText("Template work")).toBeInTheDocument();
  });

  it("shows the layer, the origin, the commit, the digest and the state of each part", async () => {
    mockReads();

    block();

    const parts = within(await screen.findByRole("list", { name: "Prompt parts of coder" }));
    const file = parts
      .getAllByRole("listitem")
      .find((item) => within(item).queryByText("instruction_file apps") !== null);
    if (file === undefined) throw new Error("No file part");
    expect(file).toHaveTextContent("Repository prompt");
    expect(file).toHaveTextContent("Repository file");
    expect(file).toHaveTextContent(COMMIT);
    expect(file).toHaveTextContent("AGENTS.md");
    expect(file).toHaveTextContent("b".repeat(64));
    expect(file).toHaveTextContent("Resolved");
    expect(file).toHaveTextContent("Default standard");
    expect(file).toHaveTextContent("Repository prompt of repository apps, file AGENTS.md:");
  });

  it("expands the text of one part", async () => {
    mockReads();
    const user = userEvent.setup();
    block();
    const parts = within(await screen.findByRole("list", { name: "Prompt parts of coder" }));

    await user.click(parts.getAllByRole("button", { name: "Show" })[0] as HTMLElement);

    expect(await parts.findByText("Shared standard.")).toBeInTheDocument();
  });

  it("states a changed shipped part with the engine version and no system prompt", async () => {
    mockReads({
      parts: [part({ state: "changed", text: null })],
      final: null,
      engine_version: "0.4.0",
    });

    block();

    expect(await screen.findByText(/A part does not resolve/)).toBeInTheDocument();
    expect(screen.queryByText(/^System prompt \d+ chars$/)).toBeNull();
    const parts = within(screen.getByRole("list", { name: "Prompt parts of coder" }));
    expect(parts.getByText("Changed")).toBeInTheDocument();
    expect(parts.getByText(/Engine version 0\.4\.0\./)).toBeInTheDocument();
    expect(parts.queryByRole("button", { name: "Show" })).toBeNull();
  });

  it("shows the line diff of a changed part against the earlier execution", async () => {
    mockReads();
    const user = userEvent.setup();
    block(SPANS, { changed: true });
    const parts = within(await screen.findByRole("list", { name: "Prompt parts of coder" }));

    expect(parts.getByText("Differs from the earlier execution")).toBeInTheDocument();
    expect(parts.getAllByRole("button", { name: "Diff" })).toHaveLength(1);
    await user.click(parts.getByRole("button", { name: "Diff" }));

    const diff = await screen.findByLabelText("Diff of instruction_file apps");
    expect(resolveAgentPrompt).toHaveBeenCalledWith("exec-0", "coder");
    expect(diff).toHaveTextContent("Line one.");
    expect(within(diff).getByText("- Old line.")).toBeInTheDocument();
    expect(within(diff).getByText("+ Line two.")).toBeInTheDocument();
  });

  it("diffs a part against the earlier part of the same binding", async () => {
    const file = (name: string, text: string) =>
      part({ ...FILE, name, binding_id: `binding-${name}`, text });
    vi.mocked(listSessionEntryPage).mockResolvedValue({ items: ENTRIES, next_cursor: null });
    vi.mocked(resolveAgentPrompt).mockImplementation(async (executionId) => ({
      ...ANSWER,
      parts:
        executionId === "exec-0"
          ? [file("app", "App rule."), file("web", "Old web rule.")]
          : [file("app", "App rule."), file("web", "New web rule.")],
    }));
    const user = userEvent.setup();
    render(
      <PromptBlock
        traceId="trace-1"
        executionId="exec-1"
        spans={SPANS}
        selection={selectionOf()}
        diffBase={{
          executionId: "exec-0",
          changed: new Map([["coder", new Set(["instruction_file:web"])]]),
        }}
      />,
    );
    const parts = within(await screen.findByRole("list", { name: "Prompt parts of coder" }));

    await user.click(parts.getByRole("button", { name: "Diff" }));

    const diff = await screen.findByLabelText("Diff of instruction_file web");
    expect(within(diff).getByText("- Old web rule.")).toBeInTheDocument();
    expect(within(diff).getByText("+ New web rule.")).toBeInTheDocument();
    expect(diff).not.toHaveTextContent("App rule.");
  });

  it("shows the refusal of one agent", async () => {
    mockReads();
    const { ApiError } = await import("@/api/errors");
    vi.mocked(resolveAgentPrompt).mockRejectedValue(
      new ApiError("not_found", "No prompt record of coder.", 404, "agent.prompt.record_absent"),
    );

    block();

    expect(await screen.findByText("No prompt record of coder.")).toBeInTheDocument();
  });

  it("shows and hides the work prompt text", async () => {
    mockReads();
    const user = userEvent.setup();
    block();
    const group = await screen.findByRole("list", { name: "Work prompts" });

    await user.click(within(group).getByRole("button", { name: "Show" }));

    expect(await within(group).findByText("Do task one now")).toBeInTheDocument();
    await user.click(within(group).getByRole("button", { name: "Hide" }));
    await waitFor(() => expect(within(group).queryByText("Do task one now")).toBeNull());
  });

  it("opens the system prompt and the work prompt in the conversation", async () => {
    mockReads();
    const open = vi.fn();
    const user = userEvent.setup();
    block(SPANS, { open });
    const system = await screen.findByRole("list", { name: "System prompt" });
    const group = screen.getByRole("list", { name: "Work prompts" });

    await user.click(within(system).getByRole("button", { name: "Open in conversation" }));
    await user.click(within(group).getByRole("button", { name: "Open in conversation" }));

    expect(open).toHaveBeenNthCalledWith(1, "session-1", "pinned");
    expect(open).toHaveBeenNthCalledWith(2, "session-1", "work-1");
  });

  it("says that the trace has no prompt record", () => {
    block(SPANS.filter((item) => item.operation !== "agent.prompt"));

    expect(screen.getByText("No prompt record for this trace.")).toBeInTheDocument();
  });
});
