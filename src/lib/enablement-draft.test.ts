import { describe, expect, it } from "vitest";

import {
  EMPTY_ENABLEMENT,
  enablementBodyOf,
  providerKindOf,
  reasoningEffortOf,
} from "./enablement-draft";

describe("enablementBodyOf", () => {
  it("builds one agent provider and a default configuration that names it", () => {
    expect(
      enablementBodyOf({
        name: " router ",
        provider: "openrouter",
        credential: "router-main",
        modelIdentifier: " qwen/qwen3-coder ",
        reasoningEffort: "off",
      }),
    ).toEqual({
      ok: true,
      body: {
        agentProviders: [{ name: "router", provider: "openrouter", credential: "router-main" }],
        defaultConfiguration: {
          agentProvider: "router",
          modelIdentifier: "qwen/qwen3-coder",
          reasoningEffort: "off",
        },
      },
    });
  });

  it("selects no default and names every missing field", () => {
    expect(enablementBodyOf(EMPTY_ENABLEMENT)).toEqual({
      ok: false,
      errors: {
        name: "Enter a value.",
        provider: "Choose a value.",
        credential: "Choose a value.",
        modelIdentifier: "Enter a value.",
        reasoningEffort: "Choose a value.",
      },
    });
  });
});

describe("providerKindOf and reasoningEffortOf", () => {
  it("accept only a contract value", () => {
    expect(providerKindOf("anthropic")).toBe("anthropic");
    expect(providerKindOf("github")).toBe("");
    expect(providerKindOf(null)).toBe("");
    expect(reasoningEffortOf("xhigh")).toBe("xhigh");
    expect(reasoningEffortOf("extreme")).toBe("");
  });
});
