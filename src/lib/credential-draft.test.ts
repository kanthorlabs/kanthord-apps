import { describe, expect, it } from "vitest";

import type { CredentialPlatformEntry } from "@/api/types";
import {
  EMPTY_METADATA,
  EMPTY_MODEL,
  EMPTY_SECRET,
  createBodyOf,
  credentialNameError,
  editMetadataOf,
  loginModeOf,
  metadataDraftOf,
  rotateMetadataOf,
  secretOfDraft,
} from "./credential-draft";

function apiKey(platform: string, metadataFields: readonly string[] = []): CredentialPlatformEntry {
  return { platform, secretShape: "api_key", loginModes: [], metadataFields, verifiable: true };
}

const GITHUB = apiKey("github");
const OPENROUTER = apiKey("openrouter");
const OPENAI_COMPATIBLE = apiKey("openai-compatible", ["baseUrl"]);
const CLOUDFLARE_AI_GATEWAY: CredentialPlatformEntry = {
  ...apiKey("cloudflare-ai-gateway", ["account_id", "gateway_id"]),
  verifiable: false,
};
const S3: CredentialPlatformEntry = {
  platform: "s3",
  secretShape: "s3_access_key",
  loginModes: [],
  metadataFields: ["endpoint", "bucket", "region"],
  verifiable: true,
};
const GITHUB_COPILOT: CredentialPlatformEntry = {
  platform: "github-copilot",
  secretShape: "oauth",
  loginModes: ["device"],
  metadataFields: [],
  verifiable: true,
};

const OPENAI = {
  baseUrl: "https://openrouter.ai/api/v1",
  models: [{ id: "qwen-plus", contextWindow: 32000, reasoningLevels: ["off", "high"] }],
};

describe("credentialNameError", () => {
  it("accepts a lowercase name and refuses the reserved name login", () => {
    expect(credentialNameError("ci-github-2")).toBeNull();
    expect(credentialNameError("")).toBe("Enter a name.");
    expect(credentialNameError("2ci")).toMatch(/lowercase letter/);
    expect(credentialNameError("a".repeat(64))).toBe("Use at most 63 characters.");
    expect(credentialNameError("login")).toMatch(/reserved/);
  });
});

describe("secretOfDraft", () => {
  it("keeps the exact api key value", () => {
    expect(secretOfDraft("api_key", { ...EMPTY_SECRET, key: " ghp-1 " })).toEqual({
      ok: true,
      value: { key: " ghp-1 " },
    });
  });

  it("refuses a blank api key", () => {
    expect(secretOfDraft("api_key", { ...EMPTY_SECRET, key: "  " })).toEqual({
      ok: false,
      errors: { key: "Enter a value." },
    });
  });

  it("builds the s3 access key and the oauth shapes", () => {
    expect(
      secretOfDraft("s3_access_key", {
        ...EMPTY_SECRET,
        accessKeyId: "AKIA1",
        secretAccessKey: "s3-secret",
      }),
    ).toEqual({ ok: true, value: { accessKeyId: "AKIA1", secretAccessKey: "s3-secret" } });
    expect(
      secretOfDraft("oauth", { ...EMPTY_SECRET, refresh: "r", access: "a", expires: "1700" }),
    ).toEqual({ ok: true, value: { refresh: "r", access: "a", expires: 1700 } });
    expect(
      secretOfDraft("oauth", { ...EMPTY_SECRET, refresh: "r", access: "a", expires: "soon" }),
    ).toMatchObject({ ok: false, errors: { expires: "Enter the expiry as Unix milliseconds." } });
  });
});

describe("createBodyOf", () => {
  it("sends null metadata for github", () => {
    expect(
      createBodyOf("ci-github", GITHUB, { ...EMPTY_SECRET, key: "k" }, EMPTY_METADATA),
    ).toEqual({
      ok: true,
      value: { name: "ci-github", platform: "github", metadata: null, secret: { key: "k" } },
    });
  });

  it("starts an openai-compatible credential with no models", () => {
    const result = createBodyOf(
      "router",
      OPENAI_COMPATIBLE,
      { ...EMPTY_SECRET, key: "k" },
      { ...EMPTY_METADATA, fields: { baseUrl: OPENAI.baseUrl } },
    );
    expect(result).toMatchObject({
      ok: true,
      value: { metadata: { baseUrl: OPENAI.baseUrl, models: [] } },
    });
  });

  it("refuses a base URL with a trailing slash or a query", () => {
    for (const baseUrl of ["https://api.openai.com/v1/", "https://x.test/v1?a=1", "ftp://x.test"]) {
      const result = createBodyOf(
        "router",
        OPENAI_COMPATIBLE,
        { ...EMPTY_SECRET, key: "k" },
        { ...EMPTY_METADATA, fields: { baseUrl } },
      );
      expect(result.ok).toBe(false);
    }
  });

  it("reports every invalid s3 field", () => {
    const result = createBodyOf("bucket-key", S3, EMPTY_SECRET, {
      ...EMPTY_METADATA,
      fields: { endpoint: "not a url" },
    });
    expect(result).toEqual({
      ok: false,
      errors: {
        accessKeyId: "Enter a value.",
        secretAccessKey: "Enter a value.",
        endpoint: "Enter a full URL, for example https://s3.amazonaws.com.",
        bucket: "Enter a value.",
        region: "Enter a value.",
      },
    });
  });
});

describe("createBodyOf with metadata fields", () => {
  it("sends each metadata field under its exact name", () => {
    expect(
      createBodyOf(
        "gateway",
        CLOUDFLARE_AI_GATEWAY,
        { ...EMPTY_SECRET, key: "k" },
        { ...EMPTY_METADATA, fields: { account_id: "acc-1", gateway_id: "gw-1" } },
      ),
    ).toEqual({
      ok: true,
      value: {
        name: "gateway",
        platform: "cloudflare-ai-gateway",
        metadata: { account_id: "acc-1", gateway_id: "gw-1" },
        secret: { key: "k" },
      },
    });
  });

  it("refuses a blank metadata field", () => {
    expect(
      createBodyOf(
        "gateway",
        CLOUDFLARE_AI_GATEWAY,
        { ...EMPTY_SECRET, key: "k" },
        { ...EMPTY_METADATA, fields: { account_id: " " } },
      ),
    ).toEqual({
      ok: false,
      errors: { account_id: "Enter a value.", gateway_id: "Enter a value." },
    });
  });
});

describe("rotateMetadataOf", () => {
  it("omits unchanged metadata so custody copies it", () => {
    const draft = metadataDraftOf(OPENAI_COMPATIBLE, OPENAI);
    expect(rotateMetadataOf(OPENAI_COMPATIBLE, OPENAI, draft)).toEqual({
      ok: true,
      value: undefined,
    });
  });

  it("sends a new base URL with the current models", () => {
    const draft = {
      ...metadataDraftOf(OPENAI_COMPATIBLE, OPENAI),
      fields: { baseUrl: "https://x.test/v1" },
    };
    expect(rotateMetadataOf(OPENAI_COMPATIBLE, OPENAI, draft)).toEqual({
      ok: true,
      value: { baseUrl: "https://x.test/v1", models: OPENAI.models },
    });
  });

  it("sends changed s3 metadata whole", () => {
    const current = { endpoint: "https://s3.test", bucket: "a", region: "eu-1" };
    const base = metadataDraftOf(S3, current);
    const draft = { ...base, fields: { ...base.fields, bucket: "b" } };
    expect(rotateMetadataOf(S3, current, draft)).toEqual({
      ok: true,
      value: { ...current, bucket: "b" },
    });
  });
});

describe("editMetadataOf", () => {
  it("keeps the base URL and writes the edited models", () => {
    const draft = {
      ...metadataDraftOf(OPENAI_COMPATIBLE, OPENAI),
      fields: { baseUrl: "https://changed.test/v1" },
      models: [
        {
          ...EMPTY_MODEL,
          id: "qwen-max",
          maxTokens: "8192",
          reasoningLevels: ["high", "off"] as const,
        },
      ],
    };
    expect(editMetadataOf(OPENAI_COMPATIBLE, OPENAI, draft)).toEqual({
      ok: true,
      value: {
        baseUrl: OPENAI.baseUrl,
        models: [{ id: "qwen-max", maxTokens: 8192, reasoningLevels: ["off", "high"] }],
      },
    });
  });

  it("refuses max tokens above the context window", () => {
    const draft = {
      ...EMPTY_METADATA,
      models: [{ ...EMPTY_MODEL, id: "m", contextWindow: "1000", maxTokens: "2000" }],
    };
    expect(editMetadataOf(OPENAI_COMPATIBLE, OPENAI, draft)).toEqual({
      ok: false,
      errors: { "models.0.maxTokens": "Use at most the context window." },
    });
  });

  it("refuses a blank model id and a non-positive limit", () => {
    const draft = { ...EMPTY_METADATA, models: [{ ...EMPTY_MODEL, contextWindow: "0" }] };
    expect(editMetadataOf(OPENAI_COMPATIBLE, OPENAI, draft)).toMatchObject({
      ok: false,
      errors: {
        "models.0.id": "Enter a value.",
        "models.0.contextWindow": "Enter a positive whole number, or leave it empty.",
      },
    });
  });

  it("flags the repeated row of a model id after trimming", () => {
    const draft = {
      ...EMPTY_METADATA,
      models: [
        { ...EMPTY_MODEL, id: "qwen" },
        { ...EMPTY_MODEL, id: "other" },
        { ...EMPTY_MODEL, id: " qwen " },
      ],
    };
    expect(editMetadataOf(OPENAI_COMPATIBLE, OPENAI, draft)).toEqual({
      ok: false,
      errors: { "models.2.id": "Use an id that no other model uses." },
    });
  });
});

describe("metadataDraftOf", () => {
  it("reads the models of a revision into text fields", () => {
    expect(metadataDraftOf(OPENAI_COMPATIBLE, OPENAI).models).toEqual([
      { id: "qwen-plus", contextWindow: "32000", maxTokens: "", reasoningLevels: ["off", "high"] },
    ]);
  });

  it("reads each metadata field of the platform as text", () => {
    expect(metadataDraftOf(S3, { endpoint: "https://s3.test", bucket: "b", region: "r" })).toEqual({
      fields: { endpoint: "https://s3.test", bucket: "b", region: "r" },
      models: [],
    });
  });
});

describe("openrouter", () => {
  it("creates an api key credential with null metadata", () => {
    expect(
      createBodyOf("router", OPENROUTER, { ...EMPTY_SECRET, key: "sk-or" }, EMPTY_METADATA),
    ).toEqual({
      ok: true,
      value: { name: "router", platform: "openrouter", metadata: null, secret: { key: "sk-or" } },
    });
  });
});

describe("oauth platform", () => {
  it("builds no create body for an oauth secret shape", () => {
    expect(
      createBodyOf("copilot", GITHUB_COPILOT, { ...EMPTY_SECRET, key: "k" }, EMPTY_METADATA),
    ).toEqual({
      ok: false,
      errors: { platform: "This platform takes its credential through a sign-in." },
    });
  });
});

describe("loginModeOf", () => {
  it("defaults to browser when the platform offers it", () => {
    expect(loginModeOf(["browser", "device"], null)).toBe("browser");
    expect(loginModeOf(["browser", "device"], "device")).toBe("device");
  });

  it("sends no mode when the platform offers only device", () => {
    expect(loginModeOf(["device"], "browser")).toBeNull();
    expect(loginModeOf(["device"], null)).toBeNull();
  });
});
