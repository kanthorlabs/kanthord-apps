import { describe, expect, it } from "vitest";

import type { MissionImportViolation } from "@/api/types";
import { violationTextOf } from "./mission-violation";

function violation(code: string, message: string, details: unknown): MissionImportViolation {
  return { code, message, filename: "sample.md", node_id: null, details };
}

const UNKNOWN_BINDING = violation("mission.node.bindings_invalid", "Invalid node bindings.", {
  binding: "your-repository-binding",
});

describe("violationTextOf", () => {
  it("names the unknown binding and lists the current binding names in order", () => {
    expect(violationTextOf(UNKNOWN_BINDING, ["coder", "acme-api"])).toEqual({
      kind: "unknown_binding",
      binding: "your-repository-binding",
      current: ["acme-api", "coder"],
    });
  });

  it("keeps the message of a binding violation with no binding name", () => {
    const counts = violation("mission.node.bindings_invalid", "Invalid node bindings.", {
      intent: "implement",
      binding_kind: "repository",
      count: 0,
    });

    expect(violationTextOf(counts, ["acme-api"])).toEqual({
      kind: "message",
      message: "Invalid node bindings.",
    });
  });

  it("keeps the message of another violation", () => {
    const grammar = violation("mission.import.plan_invalid", "The plan breaks the grammar.", {
      binding: "acme-api",
    });

    expect(violationTextOf(grammar, ["acme-api"])).toEqual({
      kind: "message",
      message: "The plan breaks the grammar.",
    });
  });

  it("keeps the message when the binding names are unknown", () => {
    expect(violationTextOf(UNKNOWN_BINDING, null)).toEqual({
      kind: "message",
      message: "Invalid node bindings.",
    });
  });
});
