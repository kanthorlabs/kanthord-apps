import { describe, expect, it } from "vitest";

import { NODE_STATES, TERMINAL_STATES } from "@/api/types";
import { isTerminal, meaningOf, stateClasses, toneOf } from "./node-state";

describe("node-state", () => {
  it("covers every state of the contract", () => {
    for (const state of NODE_STATES) {
      expect(toneOf(state)).toBeTruthy();
      expect(meaningOf(state).length).toBeGreaterThan(0);
      expect(stateClasses(state).length).toBeGreaterThan(0);
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
});
