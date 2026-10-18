import { describe, expect, it } from "vitest";

import { PLAN_FILES_DOC_URL, samplePlanFile, samplePlanHref } from "./mission-plan-sample";

describe("samplePlanFile", () => {
  it("names a plan file that the grammar accepts", () => {
    expect(samplePlanFile().filename).toMatch(/^[a-z][a-z0-9_-]*\.md$/);
  });

  it("holds the front matter, one H1, one Requirement and one Criterion", () => {
    const { content } = samplePlanFile();

    expect(content).toMatch(/^---\nintent: implement\n/);
    expect(content).toMatch(/\nverifications:\n {2}- \S/);
    expect(content.match(/^# .+$/gm)).toHaveLength(1);
    expect(content.match(/^## Requirement$/gm)).toHaveLength(1);
    expect(content.match(/^## Criterion$/gm)).toHaveLength(1);
  });

  it("names a repository binding, because an implement node needs one", () => {
    expect(samplePlanFile().content).toMatch(/\nbindings:\n {2}- \S/);
  });
});

describe("samplePlanHref", () => {
  it("encodes the content of the file as a Markdown data address", () => {
    const file = samplePlanFile();
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
