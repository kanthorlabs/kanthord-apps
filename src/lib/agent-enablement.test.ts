import { describe, expect, it } from "vitest";

import type { AgentEnablement } from "@/api/types";
import { enablementLabel, enablementVariant } from "./agent-enablement";

const ENABLED: AgentEnablement = {
  agentName: "swe@1",
  state: "enabled",
  agentProviders: [{ name: "atlas-llm", provider: "openai-compatible", credential: "atlas-main" }],
  defaultConfiguration: {
    agentProvider: "atlas-llm",
    modelIdentifier: "qwen3-coder",
    reasoningEffort: "off",
  },
  revision: 1,
};

describe("enablementLabel", () => {
  it("names an absent enablement as not enabled", () => {
    expect(enablementLabel(null)).toBe("not enabled");
  });

  it("names the state of a record", () => {
    expect(enablementLabel(ENABLED)).toBe("enabled");
    expect(enablementLabel({ ...ENABLED, state: "disabled" })).toBe("disabled");
  });
});

describe("enablementVariant", () => {
  it("gives each state its own variant", () => {
    expect(enablementVariant(ENABLED)).toBe("default");
    expect(enablementVariant({ ...ENABLED, state: "disabled" })).toBe("secondary");
    expect(enablementVariant(null)).toBe("outline");
  });
});
