import { describe, expect, it } from "vitest";

import type {
  AgentEnablement,
  AgentSummary,
  AgentVariantItem,
  WorkbenchConfiguration,
} from "@/api/types";
import { configurationTargetOf, guestMentionRefusalOf } from "./workbench-mention";

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

describe("guestMentionRefusalOf", () => {
  const NAMES = ["Yumi", "Jeremy"];
  const LINE = "A guest can ask only Yumi or Jeremy in this conversation.";

  it("answers null for a known leading mention, in any case, before punctuation", () => {
    expect(guestMentionRefusalOf("@Yumi hi", NAMES)).toBeNull();
    expect(guestMentionRefusalOf("@yumi hi", NAMES)).toBeNull();
    expect(guestMentionRefusalOf("@Yumi, status?", NAMES)).toBeNull();
  });

  it("refuses a name that does not end after the known name", () => {
    expect(guestMentionRefusalOf("@Yumix hi", NAMES)).toBe(LINE);
  });

  it("answers null for a note with no leading mention", () => {
    expect(guestMentionRefusalOf("hi @Unknown", NAMES)).toBeNull();
    expect(guestMentionRefusalOf("@ hi", NAMES)).toBeNull();
    expect(guestMentionRefusalOf("@", NAMES)).toBeNull();
  });

  it("refuses an unknown leading mention", () => {
    expect(guestMentionRefusalOf("@Unknown hi", NAMES)).toBe(LINE);
  });

  it("joins three names and answers the no-agent line for an empty list", () => {
    expect(guestMentionRefusalOf("@Unknown hi", ["Yumi", "Jeremy", "Night Ops"])).toBe(
      "A guest can ask only Yumi, Jeremy or Night Ops in this conversation.",
    );
    expect(guestMentionRefusalOf("@Unknown hi", ["Yumi"])).toBe(
      "A guest can ask only Yumi in this conversation.",
    );
    expect(guestMentionRefusalOf("@Unknown hi", [])).toBe(
      "A guest can ask no agent in this conversation.",
    );
  });
});
