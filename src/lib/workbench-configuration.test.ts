import { describe, expect, it } from "vitest";

import type { AgentEnablement, AgentModel } from "@/api/types";
import {
  configurationOf,
  draftOf,
  effortAfterModelChange,
  effortOptions,
  modelAfterProviderChange,
  modelOptions,
} from "./workbench-configuration";

const ENABLEMENT: AgentEnablement = {
  agent_name: "swe@1",
  state: "enabled",
  agent_providers: [{ name: "atlas-llm", provider: "openai-compatible", credential: "atlas-main" }],
  default_configuration: {
    agent_provider: "atlas-llm",
    model_identifier: "qwen3-coder",
    reasoning_effort: "off",
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
        agent_provider: "atlas-llm",
        model_identifier: "gpt-5",
        reasoning_effort: "high",
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

const MODELS: readonly AgentModel[] = [
  { model_identifier: "qwen3-coder", reasoning_efforts: ["off", "low", "high"] },
  { model_identifier: "glm-4.6", reasoning_efforts: ["off"] },
  { model_identifier: "plain", reasoning_efforts: [] },
];

describe("modelOptions", () => {
  it("lists the models of the list", () => {
    expect(modelOptions("gpt-5", MODELS)).toEqual(["qwen3-coder", "glm-4.6", "plain"]);
  });

  it("keeps the current model selectable without a list", () => {
    expect(modelOptions("gpt-5", null)).toEqual(["gpt-5"]);
    expect(modelOptions("", null)).toEqual([]);
  });
});

describe("effortOptions", () => {
  it("lists the reasoning efforts of the model", () => {
    expect(effortOptions("off", "qwen3-coder", MODELS)).toEqual(["off", "low", "high"]);
  });

  it("keeps the current effort selectable without a list or for an unlisted model", () => {
    expect(effortOptions("high", "qwen3-coder", null)).toEqual(["high"]);
    expect(effortOptions("high", "gpt-5", MODELS)).toEqual(["high"]);
    expect(effortOptions("", "gpt-5", MODELS)).toEqual([]);
  });
});

describe("modelAfterProviderChange", () => {
  it("takes the first listed model of the new provider", () => {
    expect(modelAfterProviderChange(MODELS)).toBe("qwen3-coder");
  });

  it("leaves the model blank when the new provider lists none", () => {
    expect(modelAfterProviderChange([])).toBe("");
  });
});

describe("effortAfterModelChange", () => {
  it("keeps the current effort when the model lists it", () => {
    expect(effortAfterModelChange("low", "qwen3-coder", MODELS)).toBe("low");
  });

  it("takes the first listed effort otherwise", () => {
    expect(effortAfterModelChange("high", "glm-4.6", MODELS)).toBe("off");
  });

  it("keeps the current effort for a model without efforts or an unlisted model", () => {
    expect(effortAfterModelChange("high", "plain", MODELS)).toBe("high");
    expect(effortAfterModelChange("high", "gpt-5", MODELS)).toBe("high");
  });
});
