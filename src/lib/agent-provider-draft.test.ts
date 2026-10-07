import { describe, expect, it } from "vitest";

import type { AgentEnablement, Credential } from "@/api/types";
import {
  agentProviderBodyOf,
  missingAgentProviderFields,
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
  revision: 3,
};

const CODEX: Credential = { name: "openai-codex-elsa", platform: "openai-codex", revisions: [] };

describe("agentProviderBodyOf", () => {
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
      "Credential",
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
    expect(unusedProviderCredentials([CODEX, custom, used], ENABLEMENT)).toEqual([CODEX]);
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
    expect(providerRemovalBlock(ENABLEMENT, "copilot")).toBe(
      "An enablement keeps at least one agent provider. Add another agent provider first.",
    );
  });

  it("keeps the agent provider of the default configuration", () => {
    expect(providerRemovalBlock(two, "copilot")).toBe(
      "The default configuration names copilot. Change the default configuration first.",
    );
  });

  it("allows another agent provider", () => {
    expect(providerRemovalBlock(two, "codex")).toBeNull();
  });
});
