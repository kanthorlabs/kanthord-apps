import { describe, expect, it } from "vitest";

import { GUARD_CLASS_FACTS, toolCountsLine } from "./agent-tools";

const NONE = { builtin: 0, "kanthord-mcp": 0, host: 0, operation: 0 };

describe("toolCountsLine", () => {
  it("lists each non-zero source in the fixed order", () => {
    expect(toolCountsLine({ builtin: 7, "kanthord-mcp": 2, host: 1, operation: 7 })).toBe(
      "7 builtin, 1 host, 2 kanthord-mcp, 7 operation",
    );
  });

  it("skips a source with no tool", () => {
    expect(toolCountsLine({ ...NONE, operation: 3 })).toBe("3 operation");
  });

  it("says No tools when every count is zero", () => {
    expect(toolCountsLine(NONE)).toBe("No tools");
  });
});

describe("GUARD_CLASS_FACTS", () => {
  it("holds the variant and the undo line of each class", () => {
    expect(GUARD_CLASS_FACTS.read).toEqual({
      variant: "secondary",
      undo: "Reads only. Nothing to undo.",
    });
    expect(GUARD_CLASS_FACTS.card).toEqual({ variant: "default", undo: "Waits on your card." });
  });
});
