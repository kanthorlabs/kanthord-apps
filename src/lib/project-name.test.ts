import { describe, expect, it } from "vitest";

import { projectNameError } from "./project-name";

describe("projectNameError", () => {
  it("accepts a name of the contract pattern", () => {
    expect(projectNameError("kanthord")).toBeNull();
    expect(projectNameError("a-1")).toBeNull();
    expect(projectNameError("a".repeat(63))).toBeNull();
  });

  it("refuses an empty name", () => {
    expect(projectNameError("")).toBe("Enter a name.");
  });

  it("refuses a name over 63 characters", () => {
    expect(projectNameError("a".repeat(64))).toBe("Use at most 63 characters.");
  });

  it("refuses a name outside the pattern", () => {
    for (const name of ["Kanthord", "1st", "-a", "a_b", "a b"]) {
      expect(projectNameError(name)).not.toBeNull();
    }
  });
});
