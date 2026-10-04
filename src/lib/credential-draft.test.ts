import { describe, expect, it } from "vitest";

import {
  EMPTY_METADATA,
  EMPTY_MODEL,
  EMPTY_SECRET,
  createBodyOf,
  credentialNameError,
  editMetadataOf,
  metadataDraftOf,
  rotateMetadataOf,
  secretOfDraft,
} from "./credential-draft";

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
      createBodyOf("ci-github", "github", { ...EMPTY_SECRET, key: "k" }, EMPTY_METADATA),
    ).toEqual({
      ok: true,
      value: { name: "ci-github", platform: "github", metadata: null, secret: { key: "k" } },
    });
  });

  it("starts an openai-compatible credential with no models", () => {
    const result = createBodyOf(
      "router",
      "openai-compatible",
      { ...EMPTY_SECRET, key: "k" },
      { ...EMPTY_METADATA, baseUrl: OPENAI.baseUrl },
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
        "openai-compatible",
        { ...EMPTY_SECRET, key: "k" },
        { ...EMPTY_METADATA, baseUrl },
      );
      expect(result.ok).toBe(false);
    }
  });

  it("reports every invalid s3 field", () => {
    const result = createBodyOf("bucket-key", "s3", EMPTY_SECRET, {
      ...EMPTY_METADATA,
      endpoint: "not a url",
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

describe("rotateMetadataOf", () => {
  it("omits unchanged metadata so custody copies it", () => {
    const draft = metadataDraftOf("openai-compatible", OPENAI);
    expect(rotateMetadataOf("openai-compatible", OPENAI, draft)).toEqual({
      ok: true,
      value: undefined,
    });
  });

  it("sends a new base URL with the current models", () => {
    const draft = { ...metadataDraftOf("openai-compatible", OPENAI), baseUrl: "https://x.test/v1" };
    expect(rotateMetadataOf("openai-compatible", OPENAI, draft)).toEqual({
      ok: true,
      value: { baseUrl: "https://x.test/v1", models: OPENAI.models },
    });
  });

  it("sends changed s3 metadata whole", () => {
    const current = { endpoint: "https://s3.test", bucket: "a", region: "eu-1" };
    const draft = { ...metadataDraftOf("s3", current), bucket: "b" };
    expect(rotateMetadataOf("s3", current, draft)).toEqual({
      ok: true,
      value: { ...current, bucket: "b" },
    });
  });
});

describe("editMetadataOf", () => {
  it("keeps the base URL and writes the edited models", () => {
    const draft = {
      ...metadataDraftOf("openai-compatible", OPENAI),
      baseUrl: "https://changed.test/v1",
      models: [
        {
          ...EMPTY_MODEL,
          id: "qwen-max",
          maxTokens: "8192",
          reasoningLevels: ["high", "off"] as const,
        },
      ],
    };
    expect(editMetadataOf("openai-compatible", OPENAI, draft)).toEqual({
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
    expect(editMetadataOf("openai-compatible", OPENAI, draft)).toEqual({
      ok: false,
      errors: { "models.0.maxTokens": "Use at most the context window." },
    });
  });

  it("refuses a blank model id and a non-positive limit", () => {
    const draft = { ...EMPTY_METADATA, models: [{ ...EMPTY_MODEL, contextWindow: "0" }] };
    expect(editMetadataOf("openai-compatible", OPENAI, draft)).toMatchObject({
      ok: false,
      errors: {
        "models.0.id": "Enter a value.",
        "models.0.contextWindow": "Enter a positive whole number, or leave it empty.",
      },
    });
  });
});

describe("metadataDraftOf", () => {
  it("reads the models of a revision into text fields", () => {
    expect(metadataDraftOf("openai-compatible", OPENAI).models).toEqual([
      { id: "qwen-plus", contextWindow: "32000", maxTokens: "", reasoningLevels: ["off", "high"] },
    ]);
  });
});

describe("openrouter", () => {
  it("creates an api key credential with null metadata", () => {
    expect(
      createBodyOf("router", "openrouter", { ...EMPTY_SECRET, key: "sk-or" }, EMPTY_METADATA),
    ).toEqual({
      ok: true,
      value: { name: "router", platform: "openrouter", metadata: null, secret: { key: "sk-or" } },
    });
  });
});
