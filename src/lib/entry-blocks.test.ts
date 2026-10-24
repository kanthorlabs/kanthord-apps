import { describe, expect, it } from "vitest";

import { noteLine, systemLabel, systemSize, usageLine } from "./entry-blocks";
import type { EntryView } from "./session-entries";

type Assistant = Extract<EntryView, { kind: "assistant" }>;

function assistant(overrides: Partial<Assistant> = {}): Assistant {
  return {
    kind: "assistant",
    text: "",
    thinking: [],
    toolCalls: [],
    model: null,
    inputTokens: null,
    outputTokens: null,
    costUsd: null,
    ...overrides,
  };
}

describe("usageLine", () => {
  it("joins the input, the output and the cost", () => {
    expect(usageLine(assistant({ inputTokens: 1200, outputTokens: 600, costUsd: 0.06 }))).toBe(
      "1.2k in · 600 out · Est. cost $0.0600",
    );
  });

  it("omits an absent part and returns null without usage", () => {
    expect(usageLine(assistant({ outputTokens: 5 }))).toBe("5 out");
    expect(usageLine(assistant())).toBeNull();
  });
});

describe("systemLabel and systemSize", () => {
  it("names a pinned entry after its section and sums the section sizes", () => {
    const view = {
      kind: "system",
      source: "pinned",
      text: "",
      sections: [{ name: "System prompt", text: "abc" }],
    } as const;

    expect(systemLabel(view)).toBe("System prompt");
    expect(systemSize(view)).toBe("3 characters");
  });

  it("names a pi entry System prompt update and counts its text", () => {
    const view = { kind: "system", source: "pi", text: "a", sections: [] } as const;

    expect(systemLabel(view)).toBe("System prompt update");
    expect(systemSize(view)).toBe("1 character");
  });
});

describe("noteLine", () => {
  it("reads each note kind", () => {
    expect(noteLine({ kind: "compaction" })).toBe("Context compacted");
    expect(noteLine({ kind: "model_change", model: "claude-a" })).toBe("Model changed to claude-a");
    expect(noteLine({ kind: "model_change", model: null })).toBe("Model changed");
    expect(noteLine({ kind: "thinking_level_change", level: "high" })).toBe(
      "Thinking level changed to high",
    );
    expect(noteLine({ kind: "thinking_level_change", level: null })).toBe("Thinking level changed");
    expect(noteLine({ kind: "other", type: "label" })).toBe("label");
  });
});
