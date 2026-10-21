import { describe, expect, it } from "vitest";

import type { AgentModel, Credential } from "@/api/types";
import {
  EMPTY_ENABLEMENT,
  enablementBodyOf,
  enablementEffortOf,
  reasoningEffortOf,
} from "./enablement-draft";

const CREDENTIALS: readonly Credential[] = [
  {
    name: "router-main",
    platform: "openrouter",
    holder: "server",
    sealed_to: null,
    sealed_current: true,
    revisions: [],
  },
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
        fallback_configurations: [],
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

describe("enablementEffortOf", () => {
  const MODELS: readonly AgentModel[] = [
    { model_identifier: "gpt-5", reasoning_efforts: ["minimal", "low", "medium", "high"] },
    { model_identifier: "glm-4.6", reasoning_efforts: ["minimal", "off"] },
  ];

  it("defaults to medium when the model lists it", () => {
    expect(enablementEffortOf("", "gpt-5", MODELS)).toBe("medium");
  });

  it("stays empty when the model does not list medium", () => {
    expect(enablementEffortOf("", "glm-4.6", MODELS)).toBe("");
  });

  it("keeps a chosen effort that the model lists", () => {
    expect(enablementEffortOf("high", "gpt-5", MODELS)).toBe("high");
    expect(enablementEffortOf("high", "glm-4.6", MODELS)).toBe("");
  });

  it("stays empty for a model that the list does not hold", () => {
    expect(enablementEffortOf("high", "unknown", MODELS)).toBe("");
  });
});
