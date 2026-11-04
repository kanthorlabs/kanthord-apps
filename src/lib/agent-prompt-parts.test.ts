import { describe, expect, it } from "vitest";

import type { SpanAttributeValue, TraceSessionEntry, TraceSpan } from "@/api/types";

import {
  changedPromptParts,
  pinnedContextEntryIds,
  promptChanged,
  promptSourcesOf,
  taskTemplates,
  workPromptEntryIds,
} from "./agent-prompt-parts";

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

function source(part: string, name: string, digest: string, extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    part,
    name,
    origin: "binary",
    path: null,
    binding_id: null,
    commit: null,
    digest,
    ...extra,
  });
}

const STANDARD = source("standard", "base.md", "abc");
const REPOSITORY = source("repository", "apps", "def", {
  origin: "database",
  binding_id: "binding-1",
});

function prompt(sources: readonly string[], digest = "all", agent = "coder"): TraceSpan {
  return span("prompt", "agent.prompt", {
    "kanthord.agent.name": agent,
    "kanthord.prompt.sources": sources,
    "kanthord.prompt.templates_digest": digest,
  });
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

describe("promptSourcesOf", () => {
  it("parses the prompt reference of each item in reading order", () => {
    expect(promptSourcesOf(prompt([STANDARD, REPOSITORY]))).toEqual([
      {
        part: "standard",
        name: "base.md",
        origin: "binary",
        path: null,
        binding_id: null,
        commit: null,
        digest: "abc",
      },
      {
        part: "repository",
        name: "apps",
        origin: "database",
        path: null,
        binding_id: "binding-1",
        commit: null,
        digest: "def",
      },
    ]);
  });

  it("skips an item of another form", () => {
    expect(
      promptSourcesOf(
        prompt([
          STANDARD,
          "standard:base.md:abc",
          "{",
          source("rules", "style", "x"),
          source("standard", "", "x"),
          source("standard", "base.md", "x", { origin: "disk" }),
          source("standard", "base.md", "x", { commit: 7 }),
        ]),
      ).map((reference) => reference.digest),
    ).toEqual(["abc"]);
  });

  it("returns no reference for a span without the attribute", () => {
    expect(promptSourcesOf(span("x", "agent.prompt"))).toEqual([]);
  });
});

describe("promptChanged", () => {
  const base = prompt([STANDARD, REPOSITORY]);

  it("reports no change for equal prompts", () => {
    expect(promptChanged([base], [prompt([STANDARD, REPOSITORY])])).toBe(false);
  });

  it("reports a different digest of one part", () => {
    const changed = source("repository", "apps", "xyz", { origin: "database" });
    expect(promptChanged([base], [prompt([STANDARD, changed])])).toBe(true);
  });

  it("reports a different templates digest", () => {
    expect(promptChanged([base], [prompt([STANDARD, REPOSITORY], "other")])).toBe(true);
  });

  it("compares the prompts of the same agent name only", () => {
    const other = prompt([source("standard", "base.md", "zzz")], "other", "reviewer");

    expect(promptChanged([base], [other])).toBe(false);
  });
});

describe("changedPromptParts", () => {
  it("names each part of an agent whose digest differs, by part and name", () => {
    const current = prompt([
      source("standard", "base.md", "new"),
      REPOSITORY,
      source("binding", "apps", "b1"),
    ]);

    const changed = changedPromptParts([prompt([STANDARD, REPOSITORY])], [current]);

    expect([...(changed.get("coder") ?? [])]).toEqual(["standard:base.md", "binding:apps"]);
  });

  it("names no agent that the earlier execution did not run", () => {
    const changed = changedPromptParts(
      [prompt([STANDARD])],
      [prompt([STANDARD], "all", "reviewer")],
    );

    expect(changed.has("reviewer")).toBe(false);
  });
});

describe("taskTemplates", () => {
  it("takes the template of the first turn of each task", () => {
    const spans = [
      span("task-1", "worker.task"),
      span("task-2", "worker.task"),
      span(
        "turn-2",
        "agent.turn",
        { "kanthord.prompt.template": "revision" },
        {
          parent_span_id: "task-1",
          start_time: 1500,
        },
      ),
      span(
        "turn-1",
        "agent.turn",
        { "kanthord.prompt.template": "work" },
        {
          parent_span_id: "task-1",
          start_time: 1100,
        },
      ),
      span(
        "turn-3",
        "agent.turn",
        { "kanthord.prompt.template": "review" },
        {
          parent_span_id: "task-2",
        },
      ),
    ];

    expect(taskTemplates(spans)).toEqual(
      new Map([
        ["task-1", "work"],
        ["task-2", "review"],
      ]),
    );
  });
});

describe("workPromptEntryIds", () => {
  it("finds the user entry before the first turn of each task", () => {
    const spans = [
      span("task-1", "worker.task"),
      span("task-2", "worker.task", {}, { start_time: 1500 }),
      span(
        "turn-1",
        "agent.turn",
        {
          "gen_ai.conversation.id": "session-1",
          "kanthord.session.entry_id": "reply-1",
        },
        { parent_span_id: "task-1", start_time: 1100 },
      ),
      span(
        "turn-2",
        "agent.turn",
        {
          "gen_ai.conversation.id": "session-1",
          "kanthord.session.entry_id": "reply-2",
        },
        { parent_span_id: "task-2", start_time: 1600 },
      ),
    ];
    const entries = [
      entry("user-1", 1, message("user", "first")),
      entry("reply-1", 2, message("assistant", "done")),
      entry("user-2", 3, message("user", "second")),
      entry("reply-2", 4, message("assistant", "done")),
    ];

    expect(workPromptEntryIds(spans, entries)).toEqual(
      new Map([
        ["task-1", "user-1"],
        ["task-2", "user-2"],
      ]),
    );
  });

  it("returns no entry for a task without a turn", () => {
    expect(workPromptEntryIds([span("task-1", "worker.task")], [])).toEqual(new Map());
  });
});

describe("pinnedContextEntryIds", () => {
  it("lists the custom entries of the pinned context", () => {
    const entries = [
      entry("pinned", 1, {
        type: "custom",
        customType: "kanthord.pinned_context",
        data: { part: "system_prompt" },
      }),
      entry("custom", 2, { type: "custom", customType: "other" }),
      entry("user", 3, message("user", "hello")),
    ];

    expect(pinnedContextEntryIds(entries)).toEqual(["pinned"]);
  });
});
