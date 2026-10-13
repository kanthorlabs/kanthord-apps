import { describe, expect, it } from "vitest";

import { credentialLabel } from "./credential-label";

describe("credentialLabel", () => {
  it("shows the name and then the platform in parentheses", () => {
    expect(credentialLabel("openai-codex-elsa", "openai-codex")).toBe(
      "openai-codex-elsa (openai-codex)",
    );
  });

  it("shows the display label of the platform", () => {
    expect(credentialLabel("claude-elsa", "anthropic-subscription")).toBe(
      "claude-elsa (Anthropic (Claude Pro/Max))",
    );
  });
});
