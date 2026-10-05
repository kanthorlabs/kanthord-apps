import { describe, expect, it } from "vitest";

import type { BindingSetEntry } from "@/api/types";
import { draftOf, emptyDraft, entryOfDraft, type WorkerDraft } from "./binding-draft";

const REPO: BindingSetEntry = {
  kind: "repository",
  config: {
    available: true,
    platform: "github",
    address: "git@github.com:kanthorlabs/kanthord.git",
    strategy: {
      baseBranch: "main",
      action: { name: "pull_request", follows: { type: "assessment_passed" } },
    },
    sshCredential: "github-ssh",
    credential: "github-main",
  },
};
const WORKER: BindingSetEntry = {
  kind: "worker",
  config: {
    worker: "general@1",
    instanceCount: 2,
    resourceBudget: { turns: 200, wallTimeMs: 7200000 },
    entries: [{ agent: "swe@1", reasoningEffort: "high" }],
  },
};
const STORAGE: BindingSetEntry = {
  kind: "storage",
  config: {
    available: true,
    endpoint: "https://s3.eu-central-1.amazonaws.com",
    bucket: "evidence",
    region: "eu-central-1",
    prefix: "kanthord/",
    credential: "aws",
  },
};

describe("draftOf and entryOfDraft", () => {
  it("round-trips every binding kind unchanged", () => {
    for (const [name, entry] of [
      ["repo", REPO],
      ["general-main", WORKER],
      ["evidence", STORAGE],
    ] as const) {
      expect(entryOfDraft(draftOf(name, entry), [])).toEqual({ ok: true, entry });
    }
  });
});

describe("entryOfDraft", () => {
  it("refuses a taken name and a name outside the pattern", () => {
    const draft = { ...emptyDraft("worker"), name: "general-main", worker: "general@1" };
    expect(entryOfDraft(draft, ["general-main"])).toMatchObject({
      ok: false,
      errors: { name: "Another binding of this project uses this name." },
    });
    expect(entryOfDraft({ ...draft, name: "General" }, [])).toMatchObject({ ok: false });
  });

  it("refuses an HTTPS repository address", () => {
    const draft = { ...draftOf("repo", REPO), address: "https://github.com/kanthorlabs/kanthord" };
    expect(entryOfDraft(draft, [])).toMatchObject({
      ok: false,
      errors: { address: expect.any(String) },
    });
  });

  it("accepts an SSH alias host in a repository address", () => {
    const draft = {
      ...draftOf("repo", REPO),
      address: "git@kanthorlabs.github.com:kanthorlabs/kanthord.git",
      sshCredentialHost: "kanthorlabs.github.com",
    };
    expect(entryOfDraft(draft, [])).toMatchObject({ ok: true });
  });

  it("refuses a host that starts with a dash", () => {
    const draft = { ...draftOf("repo", REPO), address: "git@-oProxy.com:kanthorlabs/kanthord.git" };
    expect(entryOfDraft(draft, [])).toMatchObject({
      ok: false,
      errors: { address: expect.any(String) },
    });
  });

  it("refuses when address host does not match ssh credential host", () => {
    const draft = {
      ...draftOf("repo", REPO),
      address: "git@bitbucket.org:kanthorlabs/kanthord.git",
      sshCredentialHost: "github.com",
    };
    expect(entryOfDraft(draft, [])).toMatchObject({
      ok: false,
      errors: { address: expect.stringContaining("github.com") },
    });
  });

  it("skips host mismatch check when sshCredentialHost is empty", () => {
    const draft = {
      ...draftOf("repo", REPO),
      sshCredentialHost: "",
    };
    expect(entryOfDraft(draft, [])).toMatchObject({ ok: true });
  });

  it("requires sshCredential", () => {
    const draft = { ...draftOf("repo", REPO), sshCredential: "" };
    expect(entryOfDraft(draft, [])).toMatchObject({
      ok: false,
      errors: { sshCredential: "Enter a value." },
    });
  });

  it("allows blank credential when action is not pull_request", () => {
    const draft = { ...draftOf("repo", REPO), actionName: "merge_push" as const, credential: "" };
    expect(entryOfDraft(draft, [])).toMatchObject({ ok: true });
  });

  it("requires credential when action is pull_request", () => {
    const draft = {
      ...draftOf("repo", REPO),
      actionName: "pull_request" as const,
      credential: "",
    };
    expect(entryOfDraft(draft, [])).toMatchObject({
      ok: false,
      errors: { credential: "Open a pull request requires a credential." },
    });
  });

  it("ignores credential for gitlab and bitbucket", () => {
    const draft = {
      ...draftOf("repo", REPO),
      platform: "gitlab" as const,
      actionName: "merge_push" as const,
      credential: "",
    };
    expect(entryOfDraft(draft, [])).toMatchObject({ ok: true });
  });

  it("refuses pull_request action for gitlab and bitbucket", () => {
    const draft = {
      ...draftOf("repo", REPO),
      platform: "gitlab" as const,
      actionName: "pull_request" as const,
    };
    expect(entryOfDraft(draft, [])).toMatchObject({
      ok: false,
      errors: { actionName: expect.any(String) },
    });
  });

  it("requires both budget values or neither", () => {
    const draft = { ...(draftOf("general-main", WORKER) as WorkerDraft), wallTimeMs: "" };
    expect(entryOfDraft(draft, [])).toMatchObject({
      ok: false,
      errors: { wallTimeMs: "Enter a whole number above 0." },
    });
    expect(entryOfDraft({ ...draft, turns: "" }, [])).toMatchObject({ ok: true });
  });

  it("refuses a negative instance count and an agent entry without an agent", () => {
    const draft = {
      ...(draftOf("general-main", WORKER) as WorkerDraft),
      instanceCount: "-1",
      entries: [{ agent: "", agentProvider: "", modelIdentifier: "", reasoningEffort: "" }],
    };
    expect(entryOfDraft(draft, [])).toMatchObject({
      ok: false,
      errors: { instanceCount: expect.any(String), "entries.0.agent": "Enter a value." },
    });
  });

  it("refuses a storage endpoint that is not a URL", () => {
    const draft = { ...draftOf("evidence", STORAGE), endpoint: "s3" };
    expect(entryOfDraft(draft, [])).toMatchObject({
      ok: false,
      errors: { endpoint: expect.any(String) },
    });
  });
});
