import { describe, expect, it } from "vitest";

import type { BindingSetEntry, MissionPlanEntry } from "@/api/types";
import {
  classifyChange,
  instanceChangeSummaryOf,
  isAvailable,
  isGuarded,
  nextBindings,
  nodesNaming,
  resourceIdentityOf,
  unavailableOf,
} from "./binding-change";

const REPO: BindingSetEntry = {
  kind: "repository",
  config: {
    available: true,
    platform: "github",
    address: "git@github.com:kanthorlabs/kanthord.git",
    strategy: { base_branch: "main" },
    ssh_credential: "github-ssh",
    credential: "github-main",
  },
};
const WORKER: BindingSetEntry = {
  kind: "worker",
  config: { worker: "coder@1", instance_count: 2 },
};
const STORAGE: BindingSetEntry = {
  kind: "storage",
  config: {
    available: true,
    endpoint: "https://s3.eu-central-1.amazonaws.com",
    bucket: "evidence",
    region: "eu-central-1",
    prefix: "",
    credential: "aws",
  },
};

function withConfig<T extends BindingSetEntry>(entry: T, config: Partial<T["config"]>): T {
  return { ...entry, config: { ...entry.config, ...config } };
}

describe("resourceIdentityOf", () => {
  it("derives each kind as the engine does", () => {
    expect(resourceIdentityOf("repo", REPO)).toBe("repository:github:kanthorlabs/kanthord");
    expect(
      resourceIdentityOf(
        "repo",
        withConfig(REPO, { address: "git@kanthorlabs.github.com:kanthorlabs/kanthord.git" }),
      ),
    ).toBe("repository:github:kanthorlabs/kanthord");
    expect(resourceIdentityOf("general-main", WORKER)).toBe("worker:general-main");
    expect(resourceIdentityOf("evidence", STORAGE)).toBe(
      "storage:s3:s3.eu-central-1.amazonaws.com/evidence",
    );
  });
});

describe("classifyChange", () => {
  it("names a create, a remove and a revision", () => {
    expect(classifyChange("repo", undefined, REPO)).toBe("create");
    expect(classifyChange("repo", REPO, null)).toBe("remove");
    expect(classifyChange("repo", REPO, withConfig(REPO, { credential: "github-2" }))).toBe(
      "revise",
    );
  });

  it("names a new repository address or a new storage bucket a replacement", () => {
    expect(
      classifyChange(
        "repo",
        REPO,
        withConfig(REPO, { address: "git@github.com:kanthorlabs/apps.git" }),
      ),
    ).toBe("replace");
    expect(classifyChange("evidence", STORAGE, withConfig(STORAGE, { bucket: "other" }))).toBe(
      "replace",
    );
    expect(classifyChange("evidence", STORAGE, withConfig(STORAGE, { region: "us-east-1" }))).toBe(
      "revise",
    );
  });

  it("names a host-only change of a repository address a revision", () => {
    expect(
      classifyChange(
        "repo",
        REPO,
        withConfig(REPO, { address: "git@kanthorlabs.github.com:kanthorlabs/kanthord.git" }),
      ),
    ).toBe("revise");
  });

  it("names a switch to unavailable a disable", () => {
    expect(classifyChange("repo", REPO, unavailableOf(REPO))).toBe("disable");
    expect(classifyChange("general-main", WORKER, unavailableOf(WORKER))).toBe("disable");
    expect(classifyChange("evidence", STORAGE, unavailableOf(STORAGE))).toBe("disable");
  });

  it("guards a replacement, a disable and a remove only", () => {
    expect(
      ["create", "revise", "replace", "disable", "remove"].filter((kind) =>
        isGuarded(kind as Parameters<typeof isGuarded>[0]),
      ),
    ).toEqual(["replace", "disable", "remove"]);
  });
});

describe("isAvailable", () => {
  it("reads a worker with no instance as unavailable", () => {
    expect(isAvailable(WORKER)).toBe(true);
    expect(isAvailable(unavailableOf(WORKER))).toBe(false);
  });
});

describe("unavailableOf for a native binding", () => {
  const native: BindingSetEntry = {
    kind: "worker",
    config: { worker: "coder@1", worker_instances: ["mac-studio"] },
  };

  it("empties the instance list and sets no instance count", () => {
    const unavailable = unavailableOf(native);
    expect(unavailable.kind === "worker" && unavailable.config).toEqual({
      worker: "coder@1",
      worker_instances: [],
    });
    expect(isAvailable(native)).toBe(true);
    expect(isAvailable(unavailable)).toBe(false);
    expect(classifyChange("mac-main", native, unavailable)).toBe("disable");
  });
});

describe("instanceChangeSummaryOf", () => {
  const listing = (...names: string[]): BindingSetEntry => ({
    kind: "worker",
    config: { worker: "coder@1", worker_instances: names },
  });

  it("names an added instance and a removed instance", () => {
    expect(
      instanceChangeSummaryOf(listing("coder-1", "coder-2"), listing("coder-1", "box-1")),
    ).toBe("Adds instance box-1. Removes instance coder-2.");
  });

  it("names every instance of a new binding as added", () => {
    expect(instanceChangeSummaryOf(undefined, listing("coder-1", "coder-2"))).toBe(
      "Adds instances coder-1, coder-2.",
    );
  });

  it("names a removed list as removed instances", () => {
    expect(instanceChangeSummaryOf(listing("coder-1", "coder-2"), listing())).toBe(
      "Removes instances coder-1, coder-2.",
    );
  });

  it("answers no text when the list stays and for a binding of an external harness", () => {
    expect(instanceChangeSummaryOf(listing("coder-1"), listing("coder-1"))).toBe("");
    expect(instanceChangeSummaryOf(WORKER, WORKER)).toBe("");
  });
});

describe("nextBindings", () => {
  it("replaces or removes one binding and keeps the others", () => {
    const current = { repo: REPO, "general-main": WORKER };
    expect(Object.keys(nextBindings(current, "repo", null))).toEqual(["general-main"]);
    expect(nextBindings(current, "evidence", STORAGE)).toEqual({ ...current, evidence: STORAGE });
    expect(current).toEqual({ repo: REPO, "general-main": WORKER });
  });
});

describe("nodesNaming", () => {
  it("lists the plan entries that name the binding", () => {
    const entry = (name: string, bindings: string[]): MissionPlanEntry => ({
      filename: `${name}.md`,
      intent: "implement",
      name,
      requirement: "r",
      criterion: "c",
      verifications: ["v"],
      bindings,
    });
    expect(
      nodesNaming([entry("a", ["repo"]), entry("b", []), entry("c", ["repo", "x"])], "repo").map(
        (node) => node.name,
      ),
    ).toEqual(["a", "c"]);
  });
});
