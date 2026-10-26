import { describe, expect, it } from "vitest";

import { classify } from "./affected-tests.mjs";

const modified = (path) => ({ path, status: "modified" });

describe("classify", () => {
  it.each([
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    ".npmrc",
    ".nvmrc",
    "vite.config.ts",
    "tsconfig.json",
    "tsconfig.base.json",
    "test/setup.ts",
    ".kanthord/affected-tests.json",
    "scripts/affected-tests.mjs",
  ])("selects all for the global input %s", (path) => {
    expect(classify([modified("src/app.tsx"), modified(path)])).toEqual({
      selection: "all",
      reason: `global input: ${path}`,
      paths: [],
    });
  });

  it("selects all for a global input that a rename leaves", () => {
    const result = classify([
      { path: "docs/package.json", status: "renamed", previous_path: "package.json" },
    ]);

    expect(result.selection).toBe("all");
    expect(result.reason).toBe("global input: package.json");
  });

  it("selects all for a deleted path under src", () => {
    expect(classify([{ path: "src/old.tsx", status: "deleted" }])).toEqual({
      selection: "all",
      reason: "deleted path: src/old.tsx",
      paths: [],
    });
  });

  it("selects all for a rename out of src", () => {
    expect(
      classify([{ path: "docs/old.md", status: "renamed", previous_path: "src/old.tsx" }]),
    ).toEqual({
      selection: "all",
      reason: "deleted path: src/old.tsx",
      paths: [],
    });
  });

  it.each([
    "docs/guide/start.md",
    ".agents/skill.md",
    ".github/workflows/ci.yml",
    ".husky/pre-commit",
    ".opencode/config.json",
    "mock/daemon.mjs",
    "README.md",
    "LICENSE",
    "index.html",
    "components.json",
    "commitlint.config.mjs",
    "lint-staged.config.mjs",
    "eslint.config.mjs",
    ".editorconfig",
    ".gitignore",
    ".prettierignore",
    ".prettierrc.json",
  ])("selects none for the inert path %s", (path) => {
    expect(classify([modified(path)])).toEqual({ selection: "none", reason: null, paths: [] });
  });

  it("selects all for an unknown path", () => {
    expect(classify([modified("src/app.tsx"), modified("scripts/other.mjs")])).toEqual({
      selection: "all",
      reason: "unknown path: scripts/other.mjs",
      paths: [],
    });
  });

  it("selects all for an unknown path at the root", () => {
    expect(classify([modified("notes.txt")]).reason).toBe("unknown path: notes.txt");
  });

  it("selects related for a changed component under src", () => {
    expect(
      classify([
        modified("src/components/data-list.tsx"),
        { path: "src/features/new.tsx", status: "added" },
        modified("docs/guide.md"),
      ]),
    ).toEqual({
      selection: "related",
      reason: null,
      paths: ["src/components/data-list.tsx", "src/features/new.tsx"],
    });
  });

  it("selects related for the new path of a rename inside inert and source paths", () => {
    expect(
      classify([{ path: "src/a.tsx", status: "renamed", previous_path: "mock/a.tsx" }]),
    ).toEqual({ selection: "related", reason: null, paths: ["src/a.tsx"] });
  });

  it("selects none for no change", () => {
    expect(classify([])).toEqual({ selection: "none", reason: null, paths: [] });
  });
});
