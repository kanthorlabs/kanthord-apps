import { describe, expect, it } from "vitest";

import { instructionFileView } from "./instruction-file";

const COMMIT = "c".repeat(40);

describe("instructionFileView", () => {
  it("names the commit of a present file and of an absent file", () => {
    expect(
      instructionFileView({ path: "AGENTS.md", commit: COMMIT, state: "present", reason: null }),
    ).toEqual({ text: `AGENTS.md found at ${COMMIT}.`, problem: false });
    expect(
      instructionFileView({ path: "AGENTS.md", commit: COMMIT, state: "absent", reason: null })
        .text,
    ).toMatch(/^AGENTS\.md absent at c{40}\. The agents read no instruction file/);
  });

  it("names the reason of an invalid file as a problem", () => {
    expect(
      instructionFileView({
        path: "AGENTS.md",
        commit: COMMIT,
        state: "invalid",
        reason: "control_character",
      }),
    ).toEqual({
      text: "AGENTS.md invalid: the file holds a control character, for example a carriage return. Save refuses this file.",
      problem: true,
    });
  });

  it("gives the hint of an unreachable remote", () => {
    expect(
      instructionFileView({
        path: "AGENTS.md",
        commit: null,
        state: "unreachable",
        reason: "base_branch_absent",
      }),
    ).toEqual({
      text: "AGENTS.md unreachable. The remote does not hold the base branch.",
      problem: true,
    });
    expect(
      instructionFileView({
        path: "AGENTS.md",
        commit: null,
        state: "unreachable",
        reason: "deadline_exceeded",
      }).text,
    ).toMatch(/^AGENTS\.md unreachable\. The remote host or service did not answer/);
  });
});
