import { describe, expect, it } from "vitest";

import type { BindingSetEntry } from "@/api/types";
import {
  agentRowsOf,
  draftOf,
  emptyDraft,
  entryOfDraft,
  missingForCheck,
  missingForSave,
  withAgentEntry,
  withWorker,
  withWorkingLayerSwitch,
  type WorkerDraft,
} from "./binding-draft";
import { missingHint } from "./missing-fields";

const SWITCHES_ON = {
  agents_md: true,
  agents_local_md: true,
  claude_md: true,
  claude_local_md: true,
  project_prompt: true,
};

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
    working_layer: SWITCHES_ON,
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
  it("keeps a false working layer switch from the read to the write", () => {
    if (REPO.kind !== "repository") throw new Error("fixture");
    const entry: BindingSetEntry = {
      kind: "repository",
      config: {
        ...REPO.config,
        working_layer: { ...SWITCHES_ON, claude_md: false, project_prompt: false },
      },
    };
    const draft = draftOf("repo", entry);
    expect(draft.kind === "repository" && draft.workingLayer.claude_md).toBe(false);
    expect(entryOfDraft(draft, [])).toEqual({ ok: true, entry });
  });

  it("turns every switch on when the read carries no working layer", () => {
    if (REPO.kind !== "repository") throw new Error("fixture");
    const { working_layer: _omitted, ...config } = REPO.config;
    const result = entryOfDraft(draftOf("repo", { kind: "repository", config }), []);
    expect(result).toEqual({ ok: true, entry: REPO });
  });

  it("flips one working layer switch and keeps the others", () => {
    const draft = emptyDraft("repository");
    if (draft.kind !== "repository") throw new Error("fixture");
    const next = withWorkingLayerSwitch(draft, "claude_md", false);
    expect(next.workingLayer).toEqual({ ...SWITCHES_ON, claude_md: false });
    expect(draft.workingLayer.claude_md).toBe(true);
  });

  it("starts a new repository draft with every switch on", () => {
    const draft = emptyDraft("repository");
    expect(draft.kind === "repository" && Object.values(draft.workingLayer)).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
  });

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

describe("withWorker", () => {
  const draft = emptyDraft("worker") as WorkerDraft;

  it("fills an empty name with the worker name before the version", () => {
    expect(withWorker(draft, "developer@1")).toMatchObject({
      name: "developer",
      worker: "developer@1",
    });
  });

  it("keeps a name that the human typed and clears the agent entries", () => {
    const typed = withAgentEntry({ ...draft, name: "dev-main" }, "swe@1", true);
    expect(withWorker(typed, "developer@1")).toMatchObject({ name: "dev-main", entries: [] });
  });
});

describe("worker agent entries", () => {
  const draft = draftOf("general-main", WORKER) as WorkerDraft;

  it("lists the declared agents first and then the entries of undeclared agents", () => {
    const withExtra = withAgentEntry(draft, "old@1", true);
    expect(agentRowsOf(["re@1", "swe@1"], withExtra.entries)).toEqual([
      { agent: "re@1", declared: true, index: null },
      { agent: "swe@1", declared: true, index: 0 },
      { agent: "old@1", declared: false, index: 1 },
    ]);
  });

  it("adds an empty entry for a custom configuration and removes it again", () => {
    const custom = withAgentEntry(draft, "re@1", true);
    expect(custom.entries.map((entry) => entry.agent)).toEqual(["swe@1", "re@1"]);
    expect(withAgentEntry(custom, "re@1", false).entries).toEqual(draft.entries);
  });

  it("refuses an entry that changes no value", () => {
    const empty = withAgentEntry({ ...draft, entries: [] }, "swe@1", true);
    expect(entryOfDraft(empty, [])).toMatchObject({
      ok: false,
      errors: { "entries.0.modelIdentifier": expect.any(String) },
    });
  });

  it("refuses a custom agent provider without a model and an effort", () => {
    const provider = {
      ...draft,
      entries: [
        { agent: "swe@1", agentProvider: "codex", modelIdentifier: "", reasoningEffort: "" },
      ],
    };
    expect(entryOfDraft(provider, [])).toMatchObject({
      ok: false,
      errors: {
        "entries.0.modelIdentifier": "A custom agent provider needs a model identifier.",
        "entries.0.reasoningEffort": "A custom agent provider needs a reasoning effort.",
      },
    });
  });

  it("accepts a complete entry", () => {
    const complete = {
      ...draft,
      entries: [
        {
          agent: "swe@1",
          agentProvider: "codex",
          modelIdentifier: "gpt-6-luna",
          reasoningEffort: "high",
        },
      ],
    };
    expect(entryOfDraft(complete, [])).toMatchObject({ ok: true });
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
    expect(missingForCheck(pullRequest)).toEqual(["GitHub credential"]);
    expect(missingForCheck({ ...pullRequest, platform: "gitlab" as const })).toEqual([]);
  });

  it("names the required fields of worker and storage drafts", () => {
    expect(missingForSave({ ...emptyDraft("worker"), name: "general-main" })).toEqual(["Worker"]);
    expect(missingForSave(emptyDraft("storage"))).toEqual([
      "Name",
      "Endpoint",
      "Bucket",
      "Region",
      "Storage credential",
    ]);
  });
});
