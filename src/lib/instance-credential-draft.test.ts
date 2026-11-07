import { describe, expect, it } from "vitest";

import type { CredentialPlatformEntry } from "@/api/types";
import { EMPTY_METADATA, EMPTY_MODEL, EMPTY_SECRET } from "./credential-draft";
import {
  holderGroupsOf,
  instanceCopyBodyOf,
  sealTargetGroupsOf,
} from "./instance-credential-draft";

const ANTHROPIC: CredentialPlatformEntry = {
  platform: "anthropic",
  secret_shape: "api_key",
  login_modes: [],
  metadata_fields: [],
  verifiable: true,
};

const COMPATIBLE: CredentialPlatformEntry = {
  platform: "openai-compatible",
  secret_shape: "api_key",
  login_modes: [],
  metadata_fields: ["base_url"],
  verifiable: true,
};

describe("instanceCopyBodyOf", () => {
  it("sends the secret with every holder", () => {
    const body = instanceCopyBodyOf(
      "claude-key",
      ANTHROPIC,
      { ...EMPTY_SECRET, key: "sk-1" },
      EMPTY_METADATA,
      ["mac-studio", "build-01"],
    );
    expect(body).toEqual({
      ok: true,
      value: {
        name: "claude-key",
        platform: "anthropic",
        metadata: null,
        secret: { key: "sk-1" },
        holders: ["mac-studio", "build-01"],
      },
    });
  });

  it("takes the typed model ids of an openai-compatible copy", () => {
    const body = instanceCopyBodyOf(
      "router",
      COMPATIBLE,
      { ...EMPTY_SECRET, key: "sk-1" },
      {
        fields: { base_url: "https://openrouter.ai/api/v1" },
        models: [{ ...EMPTY_MODEL, id: "qwen3-coder" }],
      },
      ["mac-studio"],
    );
    expect(body.ok && body.value.metadata).toEqual({
      base_url: "https://openrouter.ai/api/v1",
      models: [{ id: "qwen3-coder" }],
    });
  });

  it("refuses an openai-compatible copy with no model", () => {
    const body = instanceCopyBodyOf(
      "router",
      COMPATIBLE,
      { ...EMPTY_SECRET, key: "sk-1" },
      { fields: { base_url: "https://openrouter.ai/api/v1" }, models: [] },
      ["mac-studio"],
    );
    expect(body.ok ? null : body.errors["models"]).toMatch(/Add one model or more/);
  });

  it("names the missing secret", () => {
    const body = instanceCopyBodyOf("claude-key", ANTHROPIC, EMPTY_SECRET, EMPTY_METADATA, [
      "mac-studio",
    ]);
    expect(body.ok ? null : body.errors["key"]).toBe("Enter a value.");
  });
});

describe("holderGroupsOf", () => {
  it("groups the other instances by worker", () => {
    expect(
      holderGroupsOf(
        [
          { name: "mac-studio", worker: "coder@1" },
          { name: "build-01", worker: "coder@1" },
          { name: "review-01", worker: "reviewer@1" },
        ],
        "mac-studio",
      ),
    ).toEqual([
      { worker: "coder@1", names: ["build-01"] },
      { worker: "reviewer@1", names: ["review-01"] },
    ]);
  });
});

describe("sealTargetGroupsOf", () => {
  const instance = (name: string, worker: string, placement: string, ended_at: number | null) => ({
    name,
    worker,
    placement,
    ended_at,
  });

  it("lists the live machines first and then the live worker instances by worker", () => {
    expect(
      sealTargetGroupsOf(
        [
          { name: "rack-02", ended_at: null },
          { name: "gone-01", ended_at: 3 },
          { name: "lab-01", ended_at: null },
        ],
        [
          instance("mac-studio", "coder@1", "worker", null),
          instance("build-01", "coder@1", "worker", null),
          instance("srv-01", "coder@1", "server", null),
          instance("old-01", "coder@1", "worker", 4),
          instance("review-01", "reviewer@1", "worker", null),
        ],
        "mac-studio",
      ),
    ).toEqual([
      { label: "Machines", names: ["lab-01", "rack-02"] },
      { label: "coder@1", names: ["build-01"] },
      { label: "reviewer@1", names: ["review-01"] },
    ]);
  });

  it("omits the group Machines when no other live machine exists", () => {
    expect(
      sealTargetGroupsOf(
        [{ name: "lab-01", ended_at: null }],
        [instance("review-01", "reviewer@1", "worker", null)],
        "lab-01",
      ),
    ).toEqual([{ label: "reviewer@1", names: ["review-01"] }]);
  });
});
