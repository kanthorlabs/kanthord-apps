import { describe, expect, it } from "vitest";

import type { PromptPart } from "@/api/types";

import { previewParts } from "./prompt-preview";

function part(overrides: Partial<PromptPart>): PromptPart {
  return {
    layer: 1,
    part: "standard",
    name: "base.md",
    origin: "binary",
    path: null,
    binding_id: null,
    commit: null,
    digest: "a".repeat(64),
    heading: null,
    state: "resolved",
    text: "Standard.",
    ...overrides,
  };
}

const STANDARD = part({});
const FILE = part({
  layer: 2,
  part: "instruction_file",
  name: "apps",
  origin: "repository",
  path: "AGENTS.md",
  binding_id: "binding-1",
  heading: "Repository prompt of repository apps, file AGENTS.md:",
  text: "File rules.",
});
const REPOSITORY = part({
  layer: 2,
  part: "repository",
  name: "apps",
  origin: "database",
  binding_id: "binding-1",
  heading: "Repository prompt of repository apps, set in KanthorD:",
  text: "Stored rules.",
});
const BINDING = part({
  layer: 3,
  part: "binding",
  name: "apps",
  origin: "database",
  binding_id: "binding-1",
  heading: "Binding prompt of repository apps:",
  text: "Coder rule.",
});
const FRAMING = part({ layer: null, part: "framing", name: "framing-worker", text: "Framing." });

const draft = (kind: "repository" | "binding", text: string) => ({
  kind,
  bindingId: "binding-1",
  bindingName: "apps",
  text,
});

describe("previewParts", () => {
  it("replaces the text of the stored draft part and keeps its heading", () => {
    const parts = previewParts(
      [STANDARD, FILE, REPOSITORY, BINDING, FRAMING],
      draft("repository", "New."),
    );

    expect(parts.map((item) => [item.part, item.text, item.draft])).toEqual([
      ["standard", "Standard.", false],
      ["instruction_file", "File rules.", false],
      ["repository", "New.", true],
      ["binding", "Coder rule.", false],
      ["framing", "Framing.", false],
    ]);
    expect(parts[2]?.heading).toBe(REPOSITORY.heading);
    expect(parts[2]?.digest).toBeNull();
  });

  it("removes the stored draft part when the draft text is blank", () => {
    const parts = previewParts([STANDARD, REPOSITORY, BINDING, FRAMING], draft("binding", " \n"));

    expect(parts.map((item) => item.part)).toEqual(["standard", "repository", "framing"]);
  });

  it("inserts a new repository part after the instruction file and before the binding part", () => {
    const parts = previewParts([STANDARD, FILE, BINDING, FRAMING], draft("repository", "New."));

    expect(parts.map((item) => item.part)).toEqual([
      "standard",
      "instruction_file",
      "repository",
      "binding",
      "framing",
    ]);
    expect(parts[2]).toMatchObject({ layer: 2, name: "apps", heading: null, draft: true });
  });

  it("inserts a new binding part before the framing when the binding holds no other part", () => {
    const parts = previewParts([STANDARD, FRAMING], draft("binding", "Rule."));

    expect(parts.map((item) => [item.part, item.layer])).toEqual([
      ["standard", 1],
      ["binding", 3],
      ["framing", null],
    ]);
  });

  it("adds no part for a blank draft that the stored stack does not hold", () => {
    expect(
      previewParts([STANDARD, FRAMING], draft("binding", "")).map((item) => item.part),
    ).toEqual(["standard", "framing"]);
  });
});
