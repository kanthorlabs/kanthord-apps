import { describe, expect, it } from "vitest";

import { metadataFacts, modelSummary } from "./credential-facts";

describe("metadataFacts", () => {
  it("lists the base URL and the approved models", () => {
    expect(
      metadataFacts("openai-compatible", {
        base_url: "https://openrouter.ai/api/v1",
        models: [{ id: "qwen-plus", max_tokens: 8192 }],
      }),
    ).toEqual([
      { label: "Base URL", value: "https://openrouter.ai/api/v1" },
      { label: "Models", value: "qwen-plus · max tokens 8192" },
    ]);
  });

  it("says when no model is approved", () => {
    expect(
      metadataFacts("openai-compatible", { base_url: "https://x.test", models: [] })[1],
    ).toEqual({ label: "Models", value: "none approved" });
  });

  it("lists each metadata field by its wire name and nothing for null metadata", () => {
    expect(
      metadataFacts("cloudflare-ai-gateway", { account_id: "acc-1", gateway_id: "gw-1" }),
    ).toEqual([
      { label: "account_id", value: "acc-1" },
      { label: "gateway_id", value: "gw-1" },
    ]);
    expect(metadataFacts("github", null)).toEqual([]);
  });
});

describe("modelSummary", () => {
  it("names every set limit", () => {
    expect(
      modelSummary({
        id: "m",
        context_window: 1000,
        max_tokens: 500,
        reasoning_levels: ["off", "low"],
      }),
    ).toBe("m · context 1000 · max tokens 500 · reasoning off, low");
  });
});
