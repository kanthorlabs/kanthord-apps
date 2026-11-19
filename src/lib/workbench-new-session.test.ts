import { describe, expect, it } from "vitest";

import { firstSendFailureOf, newSessionPath, newSessionRequestOf } from "./workbench-new-session";

const CONFIGURATION = {
  agent_provider: "atlas-llm",
  model_identifier: "qwen3-coder",
  reasoning_effort: "off",
} as const;

describe("newSessionPath", () => {
  it("holds the agent name and the configuration in the query", () => {
    const url = new URL(newSessionPath("ops@1", CONFIGURATION), "http://localhost");

    expect(url.pathname).toBe("/workbench/new");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      agent_name: "ops@1",
      ...CONFIGURATION,
    });
  });
});

describe("newSessionRequestOf", () => {
  it("reads back the path of newSessionPath", () => {
    const url = new URL(newSessionPath("ops@1", CONFIGURATION), "http://localhost");

    expect(newSessionRequestOf(url.searchParams)).toEqual({
      ok: true,
      agentName: "ops@1",
      agentDisplayName: null,
      variantId: null,
      configuration: CONFIGURATION,
    });
  });

  it("reads back the variant id that newSessionPath carries", () => {
    const url = new URL(
      newSessionPath("swe@1", CONFIGURATION, "SWE", "agent_variant_1"),
      "http://localhost",
    );

    expect(url.searchParams.get("variant_id")).toBe("agent_variant_1");
    expect(newSessionRequestOf(url.searchParams)).toMatchObject({
      ok: true,
      agentName: "swe@1",
      agentDisplayName: "SWE",
      variantId: "agent_variant_1",
    });
  });

  it("reads back the display name that newSessionPath carries", () => {
    const url = new URL(newSessionPath("ops@1", CONFIGURATION, "Yumi"), "http://localhost");

    expect(newSessionRequestOf(url.searchParams)).toMatchObject({
      ok: true,
      agentDisplayName: "Yumi",
    });
  });

  it("refuses a query with no agent name", () => {
    expect(newSessionRequestOf(new URLSearchParams())).toEqual({
      ok: false,
      message: "The address of this page names no agent.",
    });
  });

  it("names the fields that hold no valid value", () => {
    const params = new URLSearchParams({
      agent_name: "ops@1",
      agent_provider: "atlas-llm",
      reasoning_effort: "banana",
    });

    expect(newSessionRequestOf(params)).toEqual({
      ok: false,
      message: "The address of this page holds no valid model, reasoning effort.",
    });
  });
});

describe("firstSendFailureOf", () => {
  it("reads the failure of a first send from the route state", () => {
    const failure = { draft: "Hi", code: "conflict", message: "Refused." };

    expect(firstSendFailureOf({ firstSendFailure: failure })).toEqual(failure);
  });

  it("answers null for a state of another shape", () => {
    expect(firstSendFailureOf(null)).toBeNull();
    expect(firstSendFailureOf({})).toBeNull();
    expect(firstSendFailureOf({ firstSendFailure: { draft: "Hi" } })).toBeNull();
  });
});
