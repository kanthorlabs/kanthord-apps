import { describe, expect, it } from "vitest";

import type { PromptPart } from "@/api/types";
import {
  isDefaultStandard,
  promptLayerLabel,
  promptPartOrigin,
  promptPartPathNote,
  promptPartStateLabel,
  promptPartStateNote,
} from "./prompt-part";

const PART: PromptPart = {
  layer: 1,
  part: "role",
  name: "swe@1.md",
  origin: "binary",
  path: "/data/agents/swe@1.md",
  binding_id: null,
  commit: null,
  digest: "a".repeat(64),
  heading: null,
  state: "resolved",
  text: "Role text.",
};

describe("promptPartOrigin", () => {
  it("names a shipped part with the origin word only", () => {
    expect(promptPartOrigin(PART)).toBe("Shipped");
  });

  it("names an overridden part", () => {
    expect(promptPartOrigin({ ...PART, origin: "file" })).toBe("Overridden");
  });

  it("names a stored text and a repository file", () => {
    expect(promptPartOrigin({ ...PART, origin: "database", path: null })).toBe("Set in KanthorD");
    expect(promptPartOrigin({ ...PART, origin: "repository", path: "AGENTS.md" })).toBe(
      "Repository file",
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

  it("names the repository path of an instruction file", () => {
    expect(promptPartPathNote({ ...PART, origin: "repository", path: "AGENTS.md" })).toEqual({
      lead: "Repository file",
      path: "AGENTS.md",
    });
  });

  it("holds no note when the part has no path", () => {
    expect(promptPartPathNote({ ...PART, path: null })).toBeNull();
    expect(promptPartPathNote({ ...PART, origin: "database", path: null })).toBeNull();
  });
});

describe("promptLayerLabel and isDefaultStandard", () => {
  it("names each layer and the framing", () => {
    expect([1, 2, 3, null].map((layer) => promptLayerLabel(layer as 1 | 2 | 3 | null))).toEqual([
      "KanthorD prompt",
      "Repository prompt",
      "Binding prompt",
      "Framing",
    ]);
  });

  it("marks layer 2 and layer 3 as the default standard", () => {
    expect([1, 2, 3, null].map((layer) => isDefaultStandard(layer as 1 | 2 | 3 | null))).toEqual([
      false,
      true,
      true,
      false,
    ]);
  });
});

describe("promptPartStateLabel and promptPartStateNote", () => {
  it("names each part state and explains each state that holds no text", () => {
    expect(promptPartStateLabel("changed")).toBe("Changed");
    expect(promptPartStateNote("resolved")).toBeNull();
    expect(promptPartStateNote("changed")).toMatch(/no longer holds the text/);
    expect(promptPartStateNote("invalid")).toMatch(/too large/);
    expect(promptPartStateNote("unreachable")).toMatch(/cannot read the repository/);
  });
});
