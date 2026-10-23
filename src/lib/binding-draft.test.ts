import { describe, expect, it } from "vitest";

import type { BindingSetEntry } from "@/api/types";
import {
  advancedNeedsAttention,
  agentRowsOf,
  draftOf,
  emptyDraft,
  entryOfDraft,
  holdsAdvancedSettings,
  missingForCheck,
  missingForSave,
  pinnableHostOf,
  withAgentEntry,
  withEnvironmentDefault,
  withPlacementDefault,
  withPlatform,
  withWorker,
  withWorkerPlacement,
  withWorkingLayerSwitch,
  type RepositoryDraft,
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
    worker: "coder@1",
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

describe("binding-level fallback chain", () => {
  const chain = [
    { agent_provider: "router", model_identifier: "qwen/qwen3-max", reasoning_effort: "off" },
  ];
  const workerWith = (entry: object): BindingSetEntry => ({
    kind: "worker",
    config: { worker: "coder@1", instance_count: 1, entries: [{ agent: "swe@1", ...entry }] },
  });

  it("keeps a one-entry chain unchanged", () => {
    const entry = workerWith({ reasoning_effort: "high", fallback_configurations: chain });
    expect(entryOfDraft(draftOf("general-main", entry), [])).toEqual({ ok: true, entry });
  });

  it("keeps an empty chain and an entry that holds only a chain", () => {
    for (const entry of [
      workerWith({ reasoning_effort: "high", fallback_configurations: [] }),
      workerWith({ fallback_configurations: chain }),
    ]) {
      expect(entryOfDraft(draftOf("general-main", entry), [])).toEqual({ ok: true, entry });
    }
  });

  it("keeps an entry without the field without it", () => {
    const entry = workerWith({ reasoning_effort: "high" });
    const result = entryOfDraft(draftOf("general-main", entry), []);
    expect(result).toEqual({ ok: true, entry });
    expect(JSON.stringify(result)).not.toContain("fallback_configurations");
  });
});

describe("entryOfDraft", () => {
  it("refuses a taken name and a name outside the pattern", () => {
    const draft = { ...emptyDraft("worker"), name: "general-main", worker: "coder@1" };
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

  it("refuses an SSH alias host in a repository address and names the host set", () => {
    const draft = {
      ...draftOf("repo", REPO),
      address: "git@kanthorlabs.github.com:kanthorlabs/kanthord.git",
    };
    expect(entryOfDraft(draft, [])).toMatchObject({
      ok: false,
      errors: { address: "The host of a GitHub address must be github.com or ssh.github.com." },
    });
  });

  it("refuses a host that starts with a dash", () => {
    const draft = { ...draftOf("repo", REPO), address: "git@-oProxy.com:kanthorlabs/kanthord.git" };
    expect(entryOfDraft(draft, [])).toMatchObject({
      ok: false,
      errors: { address: expect.any(String) },
    });
  });

  it("refuses a host of another platform", () => {
    const draft = {
      ...draftOf("repo", REPO),
      address: "git@bitbucket.org:kanthorlabs/kanthord.git",
    };
    expect(entryOfDraft(draft, [])).toMatchObject({
      ok: false,
      errors: { address: "The host of a GitHub address must be github.com or ssh.github.com." },
    });
  });

  it("accepts each host of the host set of each platform", () => {
    const hosts = {
      github: ["github.com", "ssh.github.com"],
      gitlab: ["gitlab.com", "altssh.gitlab.com"],
      bitbucket: ["bitbucket.org", "altssh.bitbucket.org"],
    } as const;
    for (const [platform, names] of Object.entries(hosts)) {
      for (const host of names) {
        const draft = {
          ...draftOf("repo", REPO),
          platform: platform as keyof typeof hosts,
          actionName: "" as const,
          credential: "",
          address: `git@${host}:kanthorlabs/kanthord.git`,
        };
        expect(entryOfDraft(draft, [])).toMatchObject({ ok: true });
      }
    }
  });

  it("names the host set of the platform in the form error", () => {
    const draft = {
      ...(draftOf("repo", REPO) as RepositoryDraft),
      platform: "gitlab" as const,
      actionName: "" as const,
      credential: "",
    };
    expect(entryOfDraft({ ...draft, address: "gitlab.com:o/r" }, [])).toMatchObject({
      ok: false,
      errors: {
        address:
          "Use the form git@<host>:<owner>/<repository>.git. The host must be gitlab.com or altssh.gitlab.com.",
      },
    });
  });

  it("prefills the GitHub host in the address of a new repository draft", () => {
    const draft = emptyDraft("repository");
    expect(draft.kind === "repository" && draft.address).toBe("git@github.com:");
  });

  it("swaps a bare prefill for the prefill of the new platform and keeps a typed address", () => {
    const draft = emptyDraft("repository");
    if (draft.kind !== "repository") throw new Error("fixture");
    expect(withPlatform(draft, "gitlab").address).toBe("");
    expect(withPlatform({ ...draft, address: "" }, "github").address).toBe("git@github.com:");
    const typed = { ...draft, address: "git@github.com:o/r.git" };
    expect(withPlatform(typed, "gitlab").address).toBe("git@github.com:o/r.git");
  });

  it("drops the pull request action when the platform leaves GitHub", () => {
    const draft = emptyDraft("repository");
    if (draft.kind !== "repository") throw new Error("fixture");
    const pullRequest = { ...draft, actionName: "pull_request" as const };
    expect(withPlatform(pullRequest, "gitlab").actionName).toBe("");
    expect(withPlatform(pullRequest, "github").actionName).toBe("pull_request");
  });

  it("names the host of the address to pin only when the host set holds it", () => {
    expect(pinnableHostOf({ platform: "github", address: "git@github.com:" })).toBeNull();
    expect(pinnableHostOf({ platform: "github", address: "git@github.com:o/r" })).toBeNull();
    expect(pinnableHostOf({ platform: "github", address: "git@github.com:o/r.git" })).toBe(
      "github.com",
    );
    expect(pinnableHostOf({ platform: "github", address: "git@SSH.github.com:o/r.git" })).toBe(
      "ssh.github.com",
    );
    expect(pinnableHostOf({ platform: "gitlab", address: "git@gitlab.com:o/r.git" })).toBe(
      "gitlab.com",
    );
    expect(pinnableHostOf({ platform: "github", address: "git@gitlab.com:o/r.git" })).toBeNull();
    expect(pinnableHostOf({ platform: "github", address: "git@github-work:o/r.git" })).toBeNull();
    expect(pinnableHostOf({ platform: "github", address: "git@github.co" })).toBeNull();
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
      address: "git@gitlab.com:kanthorlabs/kanthord.git",
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

describe("worker placement", () => {
  const SERVER: BindingSetEntry = {
    kind: "worker",
    config: { worker: "coder@1", instance_count: 2, placement: "server" },
  };

  it("keeps the placement of a server binding from the read to the write", () => {
    const draft = draftOf("general-main", SERVER);
    expect(draft).toMatchObject({ placement: "server" });
    expect(entryOfDraft(draft, [])).toEqual({ ok: true, entry: SERVER });
  });

  it("writes no placement for a binding that reads none", () => {
    const result = entryOfDraft(draftOf("general-main", WORKER), []);
    expect(result).toEqual({ ok: true, entry: WORKER });
  });

  it("clears the placement when the worker changes", () => {
    const draft = draftOf("general-main", SERVER) as WorkerDraft;
    expect(withWorker(draft, "reviewer@1")).toMatchObject({ placement: null });
  });

  it("holds no placement for a new hosted binding before the agents load and server after", () => {
    const draft = { ...withWorker(emptyDraft("worker") as WorkerDraft, "coder@1") };
    expect(draft.placement).toBeNull();
    const loaded = withPlacementDefault(draft, false);
    expect(loaded.placement).toBe("server");
    expect(entryOfDraft(loaded, [])).toEqual({
      ok: true,
      entry: {
        kind: "worker",
        config: { worker: "coder@1", instance_count: 1, placement: "server" },
      },
    });
  });

  it("keeps the placement that the human chose for a hosted worker", () => {
    const draft = { ...withWorker(emptyDraft("worker") as WorkerDraft, "coder@1") };
    const chosen: WorkerDraft = { ...draft, placement: "worker" };
    expect(withPlacementDefault(chosen, false)).toBe(chosen);
  });

  it("holds no placement for a worker of an external harness", () => {
    const draft = { ...withWorker(emptyDraft("worker") as WorkerDraft, "harness@1") };
    expect(withPlacementDefault(draft, true)).toBe(draft);
    expect(withPlacementDefault({ ...draft, placement: "server" }, true).placement).toBeNull();
  });
});

describe("worker instances", () => {
  const PLACED: BindingSetEntry = {
    kind: "worker",
    config: {
      worker: "coder@1",
      placement: "worker",
      worker_instances: ["mac-studio", "build-01"],
    },
  };
  const LIVE = ["build-01", "mac-studio"];

  it("loads the instance list of a saved binding and writes it with no instance count", () => {
    const draft = draftOf("mac-main", PLACED);
    expect(draft).toMatchObject({ instances: ["mac-studio", "build-01"] });
    expect(entryOfDraft(draft, [], LIVE)).toEqual({ ok: true, entry: PLACED });
  });

  it("writes an empty list and no instance count for a new binding at the worker placement", () => {
    const draft: WorkerDraft = {
      ...withWorker(emptyDraft("worker") as WorkerDraft, "coder@1"),
      placement: "worker",
    };
    expect(missingForSave(draft)).toEqual([]);
    expect(entryOfDraft(draft, [], LIVE)).toEqual({
      ok: true,
      entry: {
        kind: "worker",
        config: { worker: "coder@1", placement: "worker", worker_instances: [] },
      },
    });
  });

  it("refuses a repeated instance, more than 64 instances and an instance of no live record", () => {
    const draft = draftOf("mac-main", PLACED) as WorkerDraft;
    expect(entryOfDraft({ ...draft, instances: ["build-01", "build-01"] }, [], LIVE)).toEqual({
      ok: false,
      errors: { instances: "List each instance once." },
    });
    const many = Array.from({ length: 65 }, (_, index) => `i-${index}`);
    expect(entryOfDraft({ ...draft, instances: many }, [], many)).toEqual({
      ok: false,
      errors: { instances: "Choose at most 64 instances." },
    });
    expect(entryOfDraft({ ...draft, instances: ["review-01"] }, [], LIVE)).toEqual({
      ok: false,
      errors: {
        instances:
          "review-01 is not a live instance of coder@1. Remove it, or add it on the worker page.",
      },
    });
  });

  it("clears the instances when the worker changes", () => {
    expect(withWorker(draftOf("mac-main", PLACED) as WorkerDraft, "reviewer@1").instances).toEqual(
      [],
    );
  });
});

describe("withWorker", () => {
  const draft = emptyDraft("worker") as WorkerDraft;

  it("fills an empty name with the worker name before the version", () => {
    expect(withWorker(draft, "coder@1")).toMatchObject({
      name: "coder",
      worker: "coder@1",
    });
  });

  it("keeps a name that the human typed and clears the agent entries", () => {
    const typed = withAgentEntry({ ...draft, name: "dev-main" }, "swe@1", true);
    expect(withWorker(typed, "coder@1")).toMatchObject({ name: "dev-main", entries: [] });
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

describe("worker tags", () => {
  const filled: WorkerDraft = {
    ...(emptyDraft("worker") as WorkerDraft),
    name: "general-mac",
    worker: "coder@1",
  };

  it("reads the tags of the config one key per line and writes them in order", () => {
    const entry: BindingSetEntry = {
      kind: "worker",
      config: {
        worker: "coder@1",
        instance_count: 1,
        tags: ["toolchain.xcode_16", "platform.macos"],
      },
    };
    const draft = draftOf("general-mac", entry);

    expect(draft.kind === "worker" && draft.tags).toBe("toolchain.xcode_16\nplatform.macos");
    expect(entryOfDraft(draft, [])).toEqual({ ok: true, entry });
  });

  it("trims each line, drops empty lines and omits an empty list", () => {
    const result = entryOfDraft({ ...filled, tags: "  platform.macos \n\n gpu.cuda\n" }, []);
    expect(result.ok && result.entry.kind === "worker" && result.entry.config.tags).toEqual([
      "platform.macos",
      "gpu.cuda",
    ]);

    const empty = entryOfDraft({ ...filled, tags: " \n" }, []);
    expect(empty.ok && empty.entry.kind === "worker" && "tags" in empty.entry.config).toBe(false);
  });

  it("starts a new worker draft with no tag", () => {
    expect((emptyDraft("worker") as WorkerDraft).tags).toBe("");
  });

  it("accepts a key of 64 bytes and names Tags for a malformed, long or repeated key", () => {
    const at64 = `a.${"b".repeat(62)}`;
    expect(missingForSave({ ...filled, tags: at64 })).toEqual([]);
    for (const tags of [
      "Platform.macos",
      "platform..macos",
      "platform.",
      "9platform",
      `a.${"b".repeat(63)}`,
      "platform.macos\nplatform.macos",
    ]) {
      expect(missingForSave({ ...filled, tags })).toEqual(["Tags"]);
    }
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

  it("names Address while the address holds only the prefill", () => {
    const draft = emptyDraft("repository");
    if (draft.kind !== "repository") throw new Error("fixture");
    expect(missingForCheck({ ...draft, address: "git@github.com:  " })).toContain("Address");
    expect(missingForCheck({ ...draft, address: "git@github.com:o" })).not.toContain("Address");
  });

  it("requires the credential only for a GitHub pull request", () => {
    const draft = emptyDraft("repository");
    if (draft.kind !== "repository") throw new Error("repository draft expected");
    const filled = {
      ...draft,
      name: "kanthord-repo",
      address: "git@github.com:kanthorlabs/kanthord.git",
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

describe("advanced settings of a worker draft", () => {
  const base = {
    ...(emptyDraft("worker") as WorkerDraft),
    worker: "coder@1",
    placement: "server" as const,
  };

  it("switches between the worker placement and server and clears the instances", () => {
    const atWorker = withWorkerPlacement({ ...base, instances: ["mac-studio"] }, true);
    expect(atWorker.placement).toBe("worker");
    expect(atWorker.instances).toEqual([]);
    expect(withWorkerPlacement(atWorker, false).placement).toBe("server");
  });

  it("holds advanced settings only for the worker placement, a budget or a tag", () => {
    expect(holdsAdvancedSettings(base)).toBe(false);
    expect(holdsAdvancedSettings({ ...base, placement: "worker" })).toBe(true);
    expect(holdsAdvancedSettings({ ...base, turns: "20" })).toBe(true);
    expect(holdsAdvancedSettings({ ...base, wallTimeMs: "1000" })).toBe(true);
    expect(holdsAdvancedSettings({ ...base, tags: "platform.macos" })).toBe(true);
  });

  it("needs attention for a budget error or an invalid tag", () => {
    expect(advancedNeedsAttention(base, {})).toBe(false);
    expect(advancedNeedsAttention(base, { turns: "Enter a whole number above 0." })).toBe(true);
    expect(advancedNeedsAttention(base, { wallTimeMs: "Enter a whole number above 0." })).toBe(
      true,
    );
    expect(advancedNeedsAttention({ ...base, tags: "Not A Tag" }, {})).toBe(true);
  });
});

describe("environment keys", () => {
  const ENVIRONMENT = {
    image: "mcr.microsoft.com/devcontainers/base:bookworm",
    customizations: { kanthord: { checks: ["pnpm test"] } },
  };
  const SECRETS = { NPM_AUTH: "registry-auth" };
  const containerWorker = (config: object): BindingSetEntry => ({
    kind: "worker",
    config: { worker: "coder@1", instance_count: 1, placement: "container", ...config },
  });

  it("keeps environment and environment_secrets of a repository through an address change", () => {
    if (REPO.kind !== "repository") throw new Error("fixture");
    const entry: BindingSetEntry = {
      kind: "repository",
      config: { ...REPO.config, environment: ENVIRONMENT, environment_secrets: SECRETS },
    };
    const draft = draftOf("repo", entry);
    if (draft.kind !== "repository") throw new Error("fixture");
    const result = entryOfDraft({ ...draft, address: "git@github.com:kanthorlabs/other.git" }, []);
    expect(result.ok).toBe(true);
    if (!result.ok || result.entry.kind !== "repository") throw new Error("fixture");
    expect(result.entry.config.address).toBe("git@github.com:kanthorlabs/other.git");
    expect(result.entry.config.environment).toEqual(ENVIRONMENT);
    expect(result.entry.config.environment_secrets).toEqual(SECRETS);
  });

  it("writes neither key for a repository that reads neither", () => {
    const result = entryOfDraft(draftOf("repo", REPO), []);
    if (!result.ok || result.entry.kind !== "repository") throw new Error("fixture");
    expect("environment" in result.entry.config).toBe(false);
    expect("environment_secrets" in result.entry.config).toBe(false);
  });

  it("round-trips the environment of a container worker", () => {
    const entry = containerWorker({ environment: "engine" });
    expect(entryOfDraft(draftOf("coder-main", entry), [])).toEqual({ ok: true, entry });
  });

  it("writes no environment at the server or worker placement", () => {
    const base = draftOf("coder-main", containerWorker({ environment: "engine" })) as WorkerDraft;
    for (const placement of ["server", "worker"] as const) {
      const result = entryOfDraft({ ...base, placement, instances: [] }, []);
      if (!result.ok || result.entry.kind !== "worker") throw new Error("fixture");
      expect("environment" in result.entry.config).toBe(false);
    }
  });

  it("names Environment for a container draft with two repositories and no choice", () => {
    const draft = {
      ...(draftOf("coder-main", containerWorker({})) as WorkerDraft),
      environment: " ",
    };
    expect(missingForSave(draft, ["engine", "web"])).toContain("Environment");
    expect(missingForSave(draft, ["engine"])).not.toContain("Environment");
    expect(missingForSave(draft, [])).not.toContain("Environment");
    expect(missingForSave({ ...draft, environment: "web" }, ["engine", "web"])).not.toContain(
      "Environment",
    );
  });

  it("presets the only repository for a container draft with no environment", () => {
    const draft = draftOf("coder-main", containerWorker({})) as WorkerDraft;
    expect(withEnvironmentDefault(draft, ["engine"]).environment).toBe("engine");
    expect(withEnvironmentDefault(draft, ["engine", "web"])).toBe(draft);
    expect(withEnvironmentDefault(draft, [])).toBe(draft);
    const atServer = { ...draft, placement: "server" as const };
    expect(withEnvironmentDefault(atServer, ["engine"])).toBe(atServer);
  });
});
