import { describe, expect, it } from "vitest";

import type { CredentialPlatformList } from "@/api/types";
import { platformEntryOf, platformGroupsOf } from "./credential-platforms";

const GITHUB = {
  platform: "github",
  secretShape: "api_key",
  loginModes: [],
  metadataFields: [],
  verifiable: true,
} as const;

const S3 = {
  platform: "s3",
  secretShape: "s3_access_key",
  loginModes: [],
  metadataFields: ["endpoint", "bucket", "region"],
  verifiable: true,
} as const;

const LIST: CredentialPlatformList = {
  items: [
    { kind: "git", platforms: [GITHUB] },
    { kind: "storage", platforms: [S3] },
  ],
};

describe("platformEntryOf", () => {
  it("finds the entry of a platform in any kind", () => {
    expect(platformEntryOf(LIST, "s3")).toEqual(S3);
  });

  it("answers null for an unknown platform or a list not yet read", () => {
    expect(platformEntryOf(LIST, "gitlab")).toBeNull();
    expect(platformEntryOf(LIST, null)).toBeNull();
    expect(platformEntryOf(null, "github")).toBeNull();
  });
});

describe("platformGroupsOf", () => {
  it("groups the platform ids by kind in the answer order", () => {
    expect(platformGroupsOf(LIST)).toEqual([
      { value: "git", items: ["github"] },
      { value: "storage", items: ["s3"] },
    ]);
    expect(platformGroupsOf(null)).toEqual([]);
  });
});
