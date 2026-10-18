import { describe, expect, it } from "vitest";

import { priorCheckOf } from "./prior-check";

describe("priorCheckOf", () => {
  it("reads a check that the form passed through the navigation", () => {
    const state = {
      priorCheck: { entry: { status: "healthy", capability: "model-list read" }, checkedAt: 7 },
    };

    expect(priorCheckOf(state)).toEqual({
      entry: { status: "healthy", capability: "model-list read" },
      checkedAt: 7,
    });
  });

  it("returns null when the navigation carries no state", () => {
    expect(priorCheckOf(null)).toBeNull();
    expect(priorCheckOf(undefined)).toBeNull();
    expect(priorCheckOf({})).toBeNull();
  });

  it("returns null for a malformed check", () => {
    expect(priorCheckOf({ priorCheck: { entry: null, checkedAt: 7 } })).toBeNull();
    expect(
      priorCheckOf({ priorCheck: { entry: { status: "healthy", capability: "c" } } }),
    ).toBeNull();
    expect(
      priorCheckOf({ priorCheck: { entry: { status: "bogus", capability: "c" }, checkedAt: 7 } }),
    ).toBeNull();
    expect(
      priorCheckOf({ priorCheck: { entry: { status: "healthy", capability: 1 }, checkedAt: 7 } }),
    ).toBeNull();
  });
});
