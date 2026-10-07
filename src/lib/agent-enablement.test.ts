import { describe, expect, it } from "vitest";

import type { AgentEnablement } from "@/api/types";
import { enablementLabel, enablementVariant } from "./agent-enablement";

const ENABLED: AgentEnablement = {
  agent_name: "swe@1",
  state: "enabled",
  agent_providers: [{ name: "atlas-llm", provider: "openai-compatible", credential: "atlas-main" }],
  default_configuration: {
    agent_provider: "atlas-llm",
    model_identifier: "qwen3-coder",
    reasoning_effort: "off",
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
