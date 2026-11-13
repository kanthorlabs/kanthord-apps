import { describe, expect, it } from "vitest";

import { AVATAR_TOKENS, avatarToken } from "./agent-avatar";

describe("avatarToken", () => {
  it("answers the same token of the palette for the same agent name", () => {
    const first = avatarToken("ops@1");

    expect(AVATAR_TOKENS).toContain(first);
    expect(avatarToken("ops@1")).toBe(first);
  });

  it("answers a token of the palette for any agent name", () => {
    for (const name of ["swe@1", "re@1", "pe@1", "ops@1", "guard@1", "", "ünï@2"]) {
      expect(AVATAR_TOKENS).toContain(avatarToken(name));
    }
  });

  it("gives each built-in agent its own token", () => {
    const tokens = ["swe@1", "re@1", "pe@1", "ops@1"].map(avatarToken);

    expect(new Set(tokens).size).toBe(4);
  });
});
