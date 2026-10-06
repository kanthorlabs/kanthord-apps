import { describe, expect, it } from "vitest";

import type { AgentEnablement } from "@/api/types";
import { configurationOf, draftOf, modelChoices } from "./workbench-configuration";

const ENABLEMENT: AgentEnablement = {
  agentName: "swe@1",
  state: "enabled",
  agentProviders: [{ name: "atlas-llm", provider: "openai-compatible", credential: "atlas-main" }],
  defaultConfiguration: {
    agentProvider: "atlas-llm",
    modelIdentifier: "qwen3-coder",
    reasoningEffort: "off",
  },
  revision: 2,
};

describe("draftOf", () => {
  it("prefills the default configuration of the enablement", () => {
    expect(draftOf(ENABLEMENT)).toEqual({
      agentProvider: "atlas-llm",
      modelIdentifier: "qwen3-coder",
      reasoningEffort: "off",
    });
  });

  it("leaves every value empty without an enablement", () => {
    expect(draftOf(null)).toEqual({ agentProvider: "", modelIdentifier: "", reasoningEffort: "" });
  });
});

describe("configurationOf", () => {
  it("builds the whole configuration with a trimmed model identifier", () => {
    expect(
      configurationOf({
        agentProvider: "atlas-llm",
        modelIdentifier: " gpt-5 ",
        reasoningEffort: "high",
      }),
    ).toEqual({
      ok: true,
      configuration: {
        agentProvider: "atlas-llm",
        modelIdentifier: "gpt-5",
        reasoningEffort: "high",
      },
    });
  });

  it("names every missing value", () => {
    expect(configurationOf(draftOf(null))).toEqual({
      ok: false,
      errors: {
        agentProvider: "Choose a value.",
        modelIdentifier: "Enter a value.",
        reasoningEffort: "Choose a value.",
      },
    });
  });
});

describe("modelChoices", () => {
  it("lists the current model and the default model once", () => {
    expect(modelChoices("gpt-5", ENABLEMENT)).toEqual(["gpt-5", "qwen3-coder"]);
    expect(modelChoices("qwen3-coder", ENABLEMENT)).toEqual(["qwen3-coder"]);
    expect(modelChoices("gpt-5", null)).toEqual(["gpt-5"]);
  });
});
