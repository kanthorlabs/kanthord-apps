import { describe, expect, it } from "vitest";

import type { BindingSet, BindingSetEntry } from "@/api/types";
import { PLAN_FILES_DOC_URL, samplePlanHref, samplePlanOf } from "./mission-plan-sample";

const REPOSITORY: BindingSetEntry = {
  kind: "repository",
  config: {
    available: true,
    platform: "github",
    address: "git@github.com:acme/api.git",
    strategy: { base_branch: "main" },
    ssh_credential: "acme-ssh",
  },
};

const WORKER: BindingSetEntry = {
  kind: "worker",
  config: { worker: "coder@1", instance_count: 1 },
};

function setOf(bindings: Record<string, BindingSetEntry>): BindingSet {
  return { version: 1, bindings };
}

describe("samplePlanOf", () => {
  it("names a plan file that the grammar accepts", () => {
    expect(samplePlanOf(null).file.filename).toMatch(/^[a-z][a-z0-9_-]*\.md$/);
  });

  it("holds the front matter, one H1, one Requirement and one Criterion", () => {
    const { content } = samplePlanOf(null).file;

    expect(content).toMatch(/^---\nintent: implement\n/);
    expect(content).toMatch(/\nverifications:\n {2}- \S/);
    expect(content.match(/^# .+$/gm)).toHaveLength(1);
    expect(content.match(/^## Requirement$/gm)).toHaveLength(1);
    expect(content.match(/^## Criterion$/gm)).toHaveLength(1);
  });

  it("asks for a HEALTH.md file and checks it with tools of the container image", () => {
    const { content } = samplePlanOf(null).file;

    expect(content).toContain("\n# Add a HEALTH.md file\n");
    expect(content).toContain(
      `\nverifications:\n  - "head -n 1 HEALTH.md | grep -qx 'status: ok'"\n---\n`,
    );
    expect(content).toMatch(/\nverifications:\n {2}- "[^"\n]+"\n---\n/);
    expect(content).not.toMatch(/npm|\/health/);
  });

  it("names the only repository binding of the project", () => {
    const sample = samplePlanOf(setOf({ "acme-api": REPOSITORY, "general-main": WORKER }));

    expect(sample.file.content).toMatch(/\nbindings:\n {2}- acme-api\n/);
    expect(sample.hint).toBeNull();
  });

  it("keeps the placeholder when the project holds several repository bindings", () => {
    const sample = samplePlanOf(setOf({ "acme-api": REPOSITORY, "acme-web": REPOSITORY }));

    expect(sample.file.content).toMatch(/\nbindings:\n {2}- your-repository-binding\n/);
    expect(sample.hint).toBeNull();
  });

  it("keeps the placeholder and asks for a repository binding when the project holds none", () => {
    const sample = samplePlanOf(setOf({ "general-main": WORKER }));

    expect(sample.file.content).toMatch(/\nbindings:\n {2}- your-repository-binding\n/);
    expect(sample.hint).toBe("Add a repository binding in Bindings before the import.");
  });

  it("keeps the placeholder and no hint while the binding set is unread", () => {
    const sample = samplePlanOf(null);

    expect(sample.file.content).toMatch(/- your-repository-binding\n/);
    expect(sample.hint).toBeNull();
  });
});

describe("samplePlanHref", () => {
  it("encodes the content of the file as a Markdown data address", () => {
    const { file } = samplePlanOf(null);
    const href = samplePlanHref(file);

    expect(href.startsWith("data:text/markdown;charset=utf-8,")).toBe(true);
    expect(decodeURIComponent(href.slice(href.indexOf(",") + 1))).toBe(file.content);
  });
});

describe("PLAN_FILES_DOC_URL", () => {
  it("points at the plan files section of the public import page", () => {
    expect(PLAN_FILES_DOC_URL).toContain("reference/mission/import.md#plan-files");
  });
});
