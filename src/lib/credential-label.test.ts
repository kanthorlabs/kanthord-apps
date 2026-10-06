import { describe, expect, it } from "vitest";

import { credentialLabel } from "./credential-label";

describe("credentialLabel", () => {
  it("shows the name and then the platform in parentheses", () => {
    expect(credentialLabel("openai-codex-elsa", "openai-codex")).toBe(
      "openai-codex-elsa (openai-codex)",
    );
  });
});
