import { describe, expect, it } from "vitest";

import { summaryPartsOf } from "./board-summary-parts";

describe("summaryPartsOf", () => {
  it("returns null without a subject", () => {
    expect(summaryPartsOf("Start: Node A now", null)).toBeNull();
  });

  it("returns null when the text does not name the subject", () => {
    expect(summaryPartsOf("Start: Node B now", "Node A")).toBeNull();
  });

  it("splits the text around the subject", () => {
    expect(summaryPartsOf("Start: Node A now", "Node A")).toEqual({
      before: "Start: ",
      after: " now",
    });
  });

  it("splits at the last occurrence of the subject", () => {
    expect(summaryPartsOf("Node A: Node A", "Node A")).toEqual({
      before: "Node A: ",
      after: "",
    });
  });
});
