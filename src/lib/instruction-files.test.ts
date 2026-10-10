import { describe, expect, it } from "vitest";

import type { InstructionFile } from "@/api/types";
import {
  absentFilesLabel,
  holdsNoInstructionFile,
  instructionFileNamesText,
  shortCommit,
} from "./instruction-files";

function file(state: InstructionFile["state"]): InstructionFile {
  return { source: "agents_md", path: "AGENTS.md", state, reason: null, text: null };
}

describe("instruction files", () => {
  it("cuts a commit to seven characters", () => {
    expect(shortCommit("3f2a9c1d4e5b6a79")).toBe("3f2a9c1");
  });

  it("counts the absent files in the footer label", () => {
    expect(absentFilesLabel(1)).toBe("Show 1 absent file");
    expect(absentFilesLabel(3)).toBe("Show 3 absent files");
  });

  it("holds no instruction file only when every file is absent", () => {
    expect(holdsNoInstructionFile([file("absent"), file("absent")])).toBe(true);
    expect(holdsNoInstructionFile([file("absent"), file("invalid")])).toBe(false);
    expect(holdsNoInstructionFile([file("absent"), file("present")])).toBe(false);
  });

  it("names the four files in order", () => {
    expect(instructionFileNamesText()).toBe(
      "AGENTS.md, AGENTS.local.md, CLAUDE.md, CLAUDE.local.md",
    );
  });
});
