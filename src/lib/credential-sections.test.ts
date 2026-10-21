import { describe, expect, it } from "vitest";

import type { Credential } from "@/api/types";
import {
  credentialDetailPath,
  credentialSectionPath,
  enableAgentsPath,
} from "./credential-sections";

function credential(name: string, platform: string, endedAt: number | null): Credential {
  return {
    name,
    platform,
    holder: "server",
    sealed_to: null,
    sealed_current: true,
    revisions: [{ id: `${name}-1`, revision: 1, metadata: null, created_at: 1, ended_at: endedAt }],
  };
}

describe("credentialSectionPath", () => {
  it("maps each component to its dashboard section", () => {
    expect(credentialSectionPath("llm")).toBe("/llm");
    expect(credentialSectionPath("repository")).toBe("/repositories");
    expect(credentialSectionPath("storage")).toBe("/storage");
  });
});

describe("credentialDetailPath", () => {
  it("encodes the credential name under the section", () => {
    expect(credentialDetailPath("repository", "ci github")).toBe("/repositories/ci%20github");
  });
});

describe("enableAgentsPath", () => {
  it("opens the agents sheet of the first live agent-provider credential", () => {
    expect(
      enableAgentsPath([
        credential("old-router", "openrouter", 2),
        credential("gem", "gemini", null),
        credential("router main", "openrouter", null),
      ]),
    ).toBe("/llm/router%20main#enable-agents");
  });

  it("answers null when no live credential can serve an agent", () => {
    expect(enableAgentsPath([credential("old-router", "openrouter", 2)])).toBeNull();
    expect(enableAgentsPath(null)).toBeNull();
  });
});
