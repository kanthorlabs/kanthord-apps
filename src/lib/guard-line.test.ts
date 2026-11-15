import { describe, expect, it } from "vitest";

import { guardLineOf, ranWithoutApprovalLineOf } from "./guard-line";

describe("guardLineOf", () => {
  it("answers the fixed text of each cause that holds no model text", () => {
    const line = (cause: "import" | "auto_mode_off" | "unavailable" | "oversize" | "no_verdict") =>
      guardLineOf({ cause, reason: null, confidence: null });

    expect([
      line("import"),
      line("auto_mode_off"),
      line("unavailable"),
      line("oversize"),
      line("no_verdict"),
    ]).toEqual([
      "Guard: import always needs your approval",
      "Auto mode is off",
      "Guard: unavailable",
      "Guard: the request is too large to judge",
      "Guard: no verdict",
    ]);
  });

  it("marks the classifier reason as model text and prints two decimals", () => {
    expect(
      guardLineOf({
        cause: "classifier",
        reason: "the owner directs this unblock",
        confidence: 0.9,
      }),
    ).toBe("Guard: Model: the owner directs this unblock (0.90)");
  });
});

describe("ranWithoutApprovalLineOf", () => {
  it("shows the reversible reason as server text with no label", () => {
    expect(ranWithoutApprovalLineOf("reversible")).toBe("Ran without approval: reversible");
  });

  it("marks any other reason as model text", () => {
    expect(ranWithoutApprovalLineOf("it only reads")).toBe(
      "Ran without approval: Model: it only reads",
    );
  });
});
