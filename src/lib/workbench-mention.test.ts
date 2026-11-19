import { describe, expect, it } from "vitest";

import type {
  AgentEnablement,
  AgentSummary,
  AgentVariantItem,
  WorkbenchConfiguration,
} from "@/api/types";
import { configurationTargetOf } from "./workbench-mention";

const CONFIGURATION: WorkbenchConfiguration = {
  agent_provider: "atlas-llm",
  model_identifier: "qwen3-coder",
  reasoning_effort: "off",
};

const SWE_ENABLEMENT = {
  agent_name: "swe@1",
  state: "enabled",
  default_configuration: { ...CONFIGURATION, model_identifier: "swe-default" },
} as unknown as AgentEnablement;

const AGENTS = [
  { agentName: "ops@1", displayName: "Yumi", enablement: null },
  { agentName: "swe@1", displayName: "SWE", enablement: SWE_ENABLEMENT },
] as unknown as readonly AgentSummary[];

const VARIANTS: readonly AgentVariantItem[] = [
  {
    id: "agent_variant_01J9ZQ4XKM3B6V8N2R5T7W0VA1",
    agent_name: "swe@1",
    display_name: "Software Architecture",
    revision: 1,
  },
];

const HOST = {
  sessionId: "session_host",
  agentName: "ops@1",
  configuration: CONFIGURATION,
  enablement: null,
};

describe("configurationTargetOf", () => {
  it("shows the default configuration of the base agent for a variant mention with no member", () => {
    const target = configurationTargetOf(
      { displayName: "Software Architecture", member: null, source: "mention" },
      HOST,
      AGENTS,
      VARIANTS,
    );

    expect(target).toEqual({
      sessionId: null,
      agentName: "swe@1",
      configuration: SWE_ENABLEMENT.default_configuration,
      enablement: SWE_ENABLEMENT,
    });
  });

  it("hides the configuration for a name that is no agent and no variant", () => {
    const target = configurationTargetOf(
      { displayName: "Nobody", member: null, source: "mention" },
      HOST,
      AGENTS,
      VARIANTS,
    );

    expect(target).toBeNull();
  });
});
