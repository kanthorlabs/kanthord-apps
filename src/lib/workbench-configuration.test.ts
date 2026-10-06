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

const MODELS: readonly AgentModel[] = [
  { modelIdentifier: "qwen3-coder", reasoningEfforts: ["off", "low", "high"] },
  { modelIdentifier: "glm-4.6", reasoningEfforts: ["off"] },
  { modelIdentifier: "plain", reasoningEfforts: [] },
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
  it("keeps the current model when the new provider lists it", () => {
    expect(modelAfterProviderChange("glm-4.6", MODELS)).toBe("glm-4.6");
  });

  it("takes the first listed model otherwise", () => {
    expect(modelAfterProviderChange("gpt-5", MODELS)).toBe("qwen3-coder");
  });

  it("keeps the current model when the list is empty", () => {
    expect(modelAfterProviderChange("gpt-5", [])).toBe("gpt-5");
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
