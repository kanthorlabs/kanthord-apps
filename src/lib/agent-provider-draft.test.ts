import { describe, expect, it } from "vitest";

import type { AgentEnablement, Credential } from "@/api/types";
import {
  agentProviderBodyOf,
  missingAgentProviderFields,
  nameAfterCredentialPick,
  providerNameOfCredential,
  unusedProviderCredentials,
  providerRemovalBlock,
} from "./agent-provider-draft";

const ENABLEMENT: AgentEnablement = {
  agent_name: "swe@1",
  state: "enabled",
  agent_providers: [
    { name: "copilot", provider: "github-copilot", credential: "github--copilot-elsa" },
  ],
  default_configuration: {
    agent_provider: "copilot",
    model_identifier: "claude-haiku-4.5",
    reasoning_effort: "off",
  },
  fallback_configurations: [],
  revision: 3,
};

const CODEX: Credential = { name: "openai-codex-elsa", platform: "openai-codex", revisions: [] };

const SUBSCRIPTION: Credential = {
  name: "claude-elsa",
  platform: "anthropic-subscription",
  revisions: [],
};

describe("agentProviderBodyOf", () => {
  it("derives anthropic-subscription from the platform of the credential", () => {
    expect(
      agentProviderBodyOf({ name: "claude", credential: SUBSCRIPTION.name }, ENABLEMENT, [
        SUBSCRIPTION,
      ]),
    ).toEqual({
      ok: true,
      body: {
        expected_revision: 3,
        name: "claude",
        provider: "anthropic-subscription",
        credential: "claude-elsa",
      },
    });
  });

  it("derives the provider from the platform of the credential", () => {
    expect(
      agentProviderBodyOf({ name: " codex ", credential: CODEX.name }, ENABLEMENT, [CODEX]),
    ).toEqual({
      ok: true,
      body: {
        expected_revision: 3,
        name: "codex",
        provider: "openai-codex",
        credential: "openai-codex-elsa",
      },
    });
  });

  it("refuses a name that the enablement already holds", () => {
    expect(
      agentProviderBodyOf({ name: "copilot", credential: CODEX.name }, ENABLEMENT, [CODEX]),
    ).toEqual({
      ok: false,
      errors: { name: "The name copilot is taken in this enablement. Choose another name." },
    });
  });
});

describe("missingAgentProviderFields", () => {
  it("names each empty required field", () => {
    expect(missingAgentProviderFields({ name: " ", credential: "" })).toEqual([
      "Name",
      "LLM credential",
    ]);
  });
});

describe("unusedProviderCredentials", () => {
  it("keeps the credentials of an agent provider kind that no agent provider names", () => {
    const custom = { name: "other", platform: "custom", revisions: [] } as unknown as Credential;
    const used: Credential = {
      name: "github--copilot-elsa",
      platform: "github-copilot",
      revisions: [],
    };
    expect(unusedProviderCredentials([CODEX, SUBSCRIPTION, custom, used], ENABLEMENT)).toEqual([
      CODEX,
      SUBSCRIPTION,
    ]);
  });
});

describe("providerRemovalBlock", () => {
  const two: AgentEnablement = {
    ...ENABLEMENT,
    agent_providers: [
      ...ENABLEMENT.agent_providers,
      { name: "codex", provider: "openai-codex", credential: "openai-codex-elsa" },
    ],
  };

  it("keeps the last agent provider", () => {
    expect(providerRemovalBlock(ENABLEMENT, "copilot")).toBe("last-provider");
  });

  it("keeps the agent provider of the default configuration", () => {
    expect(providerRemovalBlock(two, "copilot")).toBe("default-provider");
  });

  it("allows another agent provider", () => {
    expect(providerRemovalBlock(two, "codex")).toBeNull();
  });
});

describe("providerNameOfCredential", () => {
  const OTHER: AgentEnablement = {
    ...ENABLEMENT,
    agent_name: "re@1",
    agent_providers: [{ name: "router", provider: "openrouter", credential: "router-main" }],
  };

  it("returns the name of an agent provider that uses the credential", () => {
    expect(providerNameOfCredential([ENABLEMENT, OTHER], "router-main")).toBe("router");
  });

  it("returns null when no agent provider uses the credential", () => {
    expect(providerNameOfCredential([ENABLEMENT, OTHER], "codex-main")).toBeNull();
  });

  it("continues to a later enablement when an earlier name is taken", () => {
    const later: AgentEnablement = {
      ...OTHER,
      agent_name: "qa@1",
      agent_providers: [{ name: "router-qa", provider: "openrouter", credential: "router-main" }],
    };

    expect(providerNameOfCredential([OTHER, later], "router-main", ["router"])).toBe("router-qa");
  });

  it("skips a name that the target enablement holds", () => {
    expect(providerNameOfCredential([OTHER], "router-main", ["router"])).toBeNull();
  });
});

describe("nameAfterCredentialPick", () => {
  it("takes the known name for an empty name", () => {
    expect(nameAfterCredentialPick("  ", null, "router")).toBe("router");
  });

  it("replaces the name that the last pick prefilled", () => {
    expect(nameAfterCredentialPick("router", "router", "codex")).toBe("codex");
  });

  it("clears the name that the last pick prefilled when the new credential has no known name", () => {
    expect(nameAfterCredentialPick("router", "router", null)).toBe("");
  });

  it("keeps a name that the human typed", () => {
    expect(nameAfterCredentialPick("mine", "router", "codex")).toBe("mine");
  });
});
