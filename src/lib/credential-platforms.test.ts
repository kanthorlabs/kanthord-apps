import { describe, expect, it } from "vitest";

import type { CredentialPlatformList } from "@/api/types";
import { platformEntryOf, platformIdsOf } from "./credential-platforms";

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
