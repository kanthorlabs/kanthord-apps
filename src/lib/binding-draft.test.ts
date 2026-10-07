import { describe, expect, it } from "vitest";

import type { BindingSetEntry } from "@/api/types";
import {
  draftOf,
  emptyDraft,
  entryOfDraft,
  missingForCheck,
  missingForSave,
  type WorkerDraft,
} from "./binding-draft";
import { missingHint } from "./missing-fields";

const REPO: BindingSetEntry = {
  kind: "repository",
  config: {
    available: true,
    platform: "github",
    address: "git@github.com:kanthorlabs/kanthord.git",
    strategy: {
      base_branch: "main",
      action: { name: "pull_request", follows: { type: "assessment_passed" } },
    },
    ssh_credential: "github-ssh",
    credential: "github-main",
  },
};
const WORKER: BindingSetEntry = {
  kind: "worker",
  config: {
    worker: "general@1",
    instance_count: 2,
    resource_budget: { turns: 200, wall_time_ms: 7200000 },
    entries: [{ agent: "swe@1", reasoning_effort: "high" }],
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

describe("missingForCheck, missingForSave and missingHint", () => {
  it("names the required fields of an empty repository draft", () => {
    const draft = emptyDraft("repository");
    expect(draft.kind).toBe("repository");
    if (draft.kind !== "repository") return;
    expect(missingForCheck(draft)).toEqual(["Address", "SSH credential"]);
    expect(missingForSave(draft)).toEqual(["Name", "Address", "SSH credential"]);
    expect(missingHint(missingForSave(draft), "verify and save")).toBe(
      "Fill Name, Address and SSH credential to verify and save.",
    );
  });

  it("requires the credential only for a GitHub pull request", () => {
    const draft = emptyDraft("repository");
    if (draft.kind !== "repository") throw new Error("repository draft expected");
    const filled = {
      ...draft,
      name: "kanthord-repo",
      address: "git@kanthorlabs.github.com:kanthorlabs/kanthord.git",
      sshCredential: "kanthorlabs-github-com",
    };
    expect(missingForSave(filled)).toEqual([]);
    expect(missingHint(missingForSave(filled), "save")).toBeNull();
    const pullRequest = { ...filled, actionName: "pull_request" as const };
    expect(missingForCheck(pullRequest)).toEqual(["Credential"]);
    expect(missingForCheck({ ...pullRequest, platform: "gitlab" as const })).toEqual([]);
  });

  it("names the required fields of worker and storage drafts", () => {
    expect(missingForSave({ ...emptyDraft("worker"), name: "general-main" })).toEqual(["Worker"]);
    expect(missingForSave(emptyDraft("storage"))).toEqual([
      "Name",
      "Endpoint",
      "Bucket",
      "Region",
      "Credential",
    ]);
  });
});
