import { describe, expect, it } from "vitest";

import type { AgentEnablement, Credential } from "@/api/types";
import {
  agentProviderBodyOf,
  missingAgentProviderFields,
  providerCredentials,
} from "./agent-provider-draft";

const ENABLEMENT: AgentEnablement = {
  agentName: "swe@1",
  state: "enabled",
  agentProviders: [
    { name: "copilot", provider: "github-copilot", credential: "github--copilot-elsa" },
  ],
  defaultConfiguration: {
    agentProvider: "copilot",
    modelIdentifier: "claude-haiku-4.5",
    reasoningEffort: "off",
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
        expectedRevision: 3,
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

describe("providerCredentials", () => {
  it("keeps only the credentials whose platform is an agent provider kind", () => {
    const custom = { name: "other", platform: "custom", revisions: [] } as unknown as Credential;
    expect(providerCredentials([CODEX, custom])).toEqual([CODEX]);
  });
});
