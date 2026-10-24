import { describe, expect, it } from "vitest";

import type { PromptPart } from "@/api/types";
import { promptPartOrigin, promptPartPathNote } from "./prompt-part";

const PART: PromptPart = {
  part: "role",
  name: "swe@1.md",
  origin: "binary",
  path: "/data/agents/swe@1.md",
  digest: "a".repeat(64),
  text: "Role text.",
};

describe("promptPartOrigin", () => {
  it("names a shipped part with the origin word only", () => {
    expect(promptPartOrigin(PART)).toBe("Shipped");
  });

  it("names an overridden part", () => {
    expect(promptPartOrigin({ ...PART, origin: "file" })).toBe("Overridden");
  });

  it("names a binding part", () => {
    expect(promptPartOrigin({ ...PART, part: "binding", origin: "database", path: null })).toBe(
      "Binding prompt",
    );
  });
});

describe("promptPartPathNote", () => {
  it("states that the looked-up path of a shipped part holds no override file", () => {
    expect(promptPartPathNote(PART)).toEqual({
      lead: "No override file at",
      path: "/data/agents/swe@1.md",
    });
  });

  it("names the override file of an overridden part", () => {
    expect(promptPartPathNote({ ...PART, origin: "file" })).toEqual({
      lead: "Override file",
      path: "/data/agents/swe@1.md",
    });
  });

  it("holds no note when the part has no path", () => {
    expect(promptPartPathNote({ ...PART, path: null })).toBeNull();
    expect(promptPartPathNote({ ...PART, origin: "database", path: null })).toBeNull();
  });
});
