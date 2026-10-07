import { describe, expect, it } from "vitest";

import { isLastSourceOn, overrideOf, scopeOfLayer, systemLayerSummary } from "./prompt-switches";

describe("prompt switches", () => {
  it("maps the working layer of the agent page to the workbench scope", () => {
    expect(scopeOfLayer("system")).toBe("system");
    expect(scopeOfLayer("agent")).toBe("agent");
    expect(scopeOfLayer("working")).toBe("workbench");
  });

  it("finds the last source that is on", () => {
    expect(isLastSourceOn({ agent_file: false, shipped: true, custom: false }, "shipped")).toBe(
      true,
    );
    expect(isLastSourceOn({ agent_file: true, shipped: true }, "shipped")).toBe(false);
    expect(isLastSourceOn({ agent_file: false, shipped: true }, "agent_file")).toBe(false);
  });

  it("accepts only an override value", () => {
    expect(overrideOf("on")).toBe("on");
    expect(overrideOf("maybe")).toBeNull();
    expect(overrideOf(undefined)).toBeNull();
  });

  it("states the effective system layer", () => {
    expect(systemLayerSummary("inherit", false, "swe@1")).toBe(
      "Follows the server switch, which is off.",
    );
    expect(systemLayerSummary("on", false, "swe@1")).toBe(
      "Turned on for swe@1 only. The server switch is off.",
    );
  });
});
