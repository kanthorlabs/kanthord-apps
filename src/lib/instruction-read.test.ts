import { describe, expect, it } from "vitest";

import type { RepositoryBindingConfig } from "@/api/types";
import { draftOf, type RepositoryDraft } from "./binding-draft";
import { instructionReadAllowed } from "./instruction-read";

const SAVED: RepositoryBindingConfig = {
  available: true,
  platform: "github",
  address: "git@github.com:kanthorlabs/kanthord.git",
  strategy: { base_branch: "main" },
  ssh_credential: "github-ssh",
};

function draftWith(change: Partial<RepositoryDraft>): RepositoryDraft {
  const draft = draftOf("repo", { kind: "repository", config: SAVED });
  if (draft.kind !== "repository") throw new Error("fixture");
  return { ...draft, ...change };
}

describe("instructionReadAllowed", () => {
  it("allows the read of an unchanged draft", () => {
    expect(instructionReadAllowed(SAVED, draftWith({}))).toBe(true);
  });

  it("allows the read when only another field changes", () => {
    expect(
      instructionReadAllowed(SAVED, draftWith({ credential: "other", projectPrompt: "x" })),
    ).toBe(true);
  });

  it("refuses the read of a new binding", () => {
    expect(instructionReadAllowed(null, draftWith({}))).toBe(false);
  });

  it("refuses the read when the address, the SSH credential or the base branch changes", () => {
    expect(instructionReadAllowed(SAVED, draftWith({ address: "git@github.com:a/b.git" }))).toBe(
      false,
    );
    expect(instructionReadAllowed(SAVED, draftWith({ sshCredential: "other-ssh" }))).toBe(false);
    expect(instructionReadAllowed(SAVED, draftWith({ baseBranch: "develop" }))).toBe(false);
  });
});
