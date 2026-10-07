import { describe, expect, it } from "vitest";

import type { Credential } from "@/api/types";
import { EMPTY_ENABLEMENT, enablementBodyOf, reasoningEffortOf } from "./enablement-draft";

const CREDENTIALS: readonly Credential[] = [
  { name: "router-main", platform: "openrouter", revisions: [] },
];

describe("enablementBodyOf", () => {
  it("builds one agent provider of the credential platform and a default that names it", () => {
    expect(
      enablementBodyOf(
        {
          name: " router ",
          credential: "router-main",
          modelIdentifier: " qwen/qwen3-coder ",
          reasoningEffort: "off",
        },
        CREDENTIALS,
      ),
    ).toEqual({
      ok: true,
      body: {
        agent_providers: [{ name: "router", provider: "openrouter", credential: "router-main" }],
        default_configuration: {
          agent_provider: "router",
          model_identifier: "qwen/qwen3-coder",
          reasoning_effort: "off",
        },
      },
    });
  });

  it("selects no default and names every missing field", () => {
    expect(enablementBodyOf(EMPTY_ENABLEMENT, CREDENTIALS)).toEqual({
      ok: false,
      errors: {
        name: "Enter a value.",
        credential: "Choose a value.",
        modelIdentifier: "Enter a value.",
        reasoningEffort: "Choose a value.",
      },
    });
  });
});

describe("reasoningEffortOf", () => {
  it("accepts only a contract value", () => {
    expect(reasoningEffortOf("xhigh")).toBe("xhigh");
    expect(reasoningEffortOf("extreme")).toBe("");
  });
});
