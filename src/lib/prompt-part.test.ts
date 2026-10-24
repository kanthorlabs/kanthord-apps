import { describe, expect, it } from "vitest";

import type { PromptPart } from "@/api/types";
import { promptPartOrigin } from "./prompt-part";

const PART: PromptPart = {
  part: "role",
  name: "swe@1.md",
  origin: "binary",
  path: "/data/agents/swe@1.md",
  digest: "a".repeat(64),
  text: "Role text.",
};

describe("promptPartOrigin", () => {
  it("names the override path that a shipped part looked up", () => {
    expect(promptPartOrigin(PART)).toBe("Shipped (override: /data/agents/swe@1.md)");
  });

  it("names a shipped part with no override directory", () => {
    expect(promptPartOrigin({ ...PART, path: null })).toBe("Shipped");
  });

  it("names the override file of an overridden part", () => {
    expect(promptPartOrigin({ ...PART, origin: "file" })).toBe(
      "Overridden by /data/agents/swe@1.md",
    );
  });

  it("names a binding part", () => {
    expect(promptPartOrigin({ ...PART, part: "binding", origin: "database", path: null })).toBe(
      "Binding prompt",
    );
  });
});
