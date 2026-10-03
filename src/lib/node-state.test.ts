import { describe, expect, it } from "vitest";

import { NODE_STATES, TERMINAL_STATES } from "@/api/types";
import { badgeVariantOf, isTerminal, meaningOf, toneOf } from "./node-state";

describe("node-state", () => {
  it("covers every state of the contract", () => {
    for (const state of NODE_STATES) {
      expect(toneOf(state)).toBeTruthy();
      expect(meaningOf(state).length).toBeGreaterThan(0);
      expect(["default", "secondary", "destructive", "outline"]).toContain(badgeVariantOf(state));
    }
  });

  it("names exactly the two terminal states", () => {
    const terminal = NODE_STATES.filter(isTerminal);
    expect(terminal).toEqual([...TERMINAL_STATES]);
  });

  it("separates a blocked node from a discarded one", () => {
    expect(toneOf("Blocked")).toBe("attention");
    expect(toneOf("Discarded")).toBe("dropped");
  });

  it("reads External.Failed as attention and External.Success as good", () => {
    expect(toneOf("External.Failed")).toBe("attention");
    expect(toneOf("External.Success")).toBe("good");
  });

  it("states the dependency rule of the two terminal states", () => {
    expect(meaningOf("Completed")).toMatch(/satisfies a dependency/);
    expect(meaningOf("Discarded")).toMatch(/satisfies no dependency/);
  });

  it("reads Waiting as eligible for an evaluation claim", () => {
    expect(meaningOf("Waiting")).toMatch(/waits for an evaluation claim/);
  });

  it("maps each tone to a stock badge variant", () => {
    expect(badgeVariantOf("Executing")).toBe("default");
    expect(badgeVariantOf("Evaluating")).toBe("default");
    expect(badgeVariantOf("Blocked")).toBe("destructive");
    expect(badgeVariantOf("External.Failed")).toBe("destructive");
    expect(badgeVariantOf("Completed")).toBe("secondary");
    expect(badgeVariantOf("External.Success")).toBe("secondary");
    expect(badgeVariantOf("Pending")).toBe("outline");
    expect(badgeVariantOf("Available")).toBe("outline");
    expect(badgeVariantOf("Discarded")).toBe("outline");
  });
});
