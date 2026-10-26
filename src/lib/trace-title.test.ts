import { describe, expect, it } from "vitest";

import type { TraceSummary } from "@/api/types";

import { nodeNameOf, traceTitleOf } from "./trace-title";

type TitleFields = Pick<
  TraceSummary,
  "trace_id" | "execution_id" | "root_operation" | "root_attributes"
>;

function trace(overrides: Partial<TitleFields> = {}): TitleFields {
  return {
    trace_id: "trace-1",
    execution_id: null,
    root_operation: null,
    root_attributes: null,
    ...overrides,
  };
}

describe("traceTitleOf", () => {
  it("titles a trace by the node name first", () => {
    expect(traceTitleOf(trace({ execution_id: "exec-1" }), "Build the page")).toBe(
      "Build the page",
    );
  });

  it("titles a trace with no node name by the execution identity", () => {
    expect(
      traceTitleOf(trace({ execution_id: "exec-1", root_operation: "scheduler.execution" }), null),
    ).toBe("exec-1");
  });

  it("titles a trace with no execution by the label of its root span", () => {
    expect(
      traceTitleOf(
        trace({
          root_operation: "project.environment",
          root_attributes: { "project.binding.name": "web" },
        }),
        null,
      ),
    ).toBe("Environment web");
    expect(traceTitleOf(trace({ root_operation: "mission.node.pause" }), null)).toBe("Paused");
  });

  it("titles a trace with no root span by the trace identity", () => {
    expect(traceTitleOf(trace(), null)).toBe("trace-1");
  });
});

describe("nodeNameOf", () => {
  it("answers the string value of the node name attribute", () => {
    expect(nodeNameOf({ "kanthord.node.name": "Build the page" })).toBe("Build the page");
  });

  it("answers null without the attribute", () => {
    expect(nodeNameOf({ "kanthord.phase": "execute" })).toBeNull();
  });

  it("answers null for a value that is not a string", () => {
    expect(nodeNameOf({ "kanthord.node.name": 7 })).toBeNull();
  });

  it("answers null for no attributes", () => {
    expect(nodeNameOf(null)).toBeNull();
    expect(nodeNameOf(undefined)).toBeNull();
  });
});
