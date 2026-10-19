import { describe, expect, it } from "vitest";

import type { CredentialPlatformList } from "@/api/types";
import { platformEntryOf, platformGroupsOf, platformIdsOf } from "./credential-platforms";

const ANTHROPIC = {
  platform: "anthropic",
  secret_shape: "api_key",
  login_modes: [],
  metadata_fields: [],
  verifiable: true,
} as const;

const GATEWAY = {
  platform: "cloudflare-ai-gateway",
  secret_shape: "api_key",
  login_modes: [],
  metadata_fields: ["account_id", "gateway_id"],
  verifiable: false,
} as const;

const LIST: CredentialPlatformList = { items: [ANTHROPIC, GATEWAY] };

describe("platformEntryOf", () => {
  it("finds the entry of a platform in the flat list", () => {
    expect(platformEntryOf(LIST, "cloudflare-ai-gateway")).toEqual(GATEWAY);
  });

  it("answers null for an unknown platform or a list not yet read", () => {
    expect(platformEntryOf(LIST, "github")).toBeNull();
    expect(platformEntryOf(LIST, null)).toBeNull();
    expect(platformEntryOf(null, "anthropic")).toBeNull();
  });
});

describe("platformIdsOf", () => {
  it("lists the platform ids in the answer order", () => {
    expect(platformIdsOf(LIST)).toEqual(["anthropic", "cloudflare-ai-gateway"]);
    expect(platformIdsOf(null)).toEqual([]);
  });
});

describe("platformGroupsOf", () => {
  const copilot = {
    ...ANTHROPIC,
    platform: "github-copilot",
    secret_shape: "oauth",
    login_modes: ["device"],
  } as const;

  it("groups the checked, the sign-in and the other platforms in the answer order", () => {
    const openai = { ...ANTHROPIC, platform: "openai" };
    const mistral = { ...GATEWAY, platform: "mistral", metadata_fields: [] };
    expect(platformGroupsOf({ items: [GATEWAY, copilot, ANTHROPIC, mistral, openai] })).toEqual([
      { value: "Checked before save", items: ["anthropic", "openai"] },
      { value: "Sign in with an account", items: ["github-copilot"] },
      { value: "Not checked before save", items: ["cloudflare-ai-gateway", "mistral"] },
    ]);
  });

  it("puts a verifiable oauth platform under the sign-in group only", () => {
    const groups = platformGroupsOf({ items: [copilot, ANTHROPIC] });
    expect(groups.find((group) => group.value === "Checked before save")?.items).not.toContain(
      "github-copilot",
    );
    expect(groups.find((group) => group.value === "Sign in with an account")?.items).toEqual([
      "github-copilot",
    ]);
  });

  it("omits an empty group", () => {
    expect(platformGroupsOf({ items: [ANTHROPIC] })).toEqual([
      { value: "Checked before save", items: ["anthropic"] },
    ]);
    expect(platformGroupsOf(null)).toEqual([]);
  });
});
