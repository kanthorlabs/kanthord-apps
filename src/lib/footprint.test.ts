import { describe, expect, it } from "vitest";

import {
  cleanupTimingText,
  isCleanableKind,
  isFootprintKind,
  itemNoun,
  noDeleteText,
  refusalText,
} from "./footprint";

describe("itemNoun", () => {
  it("names one item and many items of a kind", () => {
    expect(itemNoun("workspace", 1)).toBe("node workspace");
    expect(itemNoun("workspace", 640)).toBe("node workspaces");
  });
});

describe("cleanupTimingText", () => {
  it("states when the instance runs the cleanup for each kind and placement", () => {
    expect(cleanupTimingText("session", "server")).toBe("KanthorD deletes these sessions at once.");
    expect(cleanupTimingText("session", "container")).toBe(
      "KanthorD deletes these sessions at once.",
    );
    expect(cleanupTimingText("workspace", "worker")).toBe(
      "The instance runs the cleanup when it reads its work, within 15 seconds while it runs.",
    );
    expect(cleanupTimingText("tool_output", "container")).toBe(
      "The instance runs the cleanup at its next report, within 15 minutes while it runs.",
    );
  });

  it("states nothing for a server kind", () => {
    expect(cleanupTimingText("trace", null)).toBeNull();
  });
});

describe("noDeleteText", () => {
  it("names the owner path of a kind with no delete", () => {
    expect(noDeleteText("log", null)).toBe(
      "The operator rotates kanthord.log. KanthorD rotates no log.",
    );
    expect(noDeleteText("slot_residue", "server")).toBe("Archive the instance to remove its slot.");
    expect(noDeleteText("slot_residue", "worker")).toBe(
      "The operator removes the files in <unit>/tmp on the host.",
    );
  });
});

describe("refusalText", () => {
  it("names the reason of a refused key", () => {
    expect(refusalText("session", "live")).toBe("In use by a running execution.");
    expect(refusalText("session", "unreadable")).toContain("cannot read");
  });
});

describe("kind guards", () => {
  it("accepts a known kind and a cleanable kind only", () => {
    expect(isFootprintKind("disk")).toBe(true);
    expect(isFootprintKind("cleanups")).toBe(false);
    expect(isCleanableKind("trace")).toBe(true);
    expect(isCleanableKind("log")).toBe(false);
  });
});
