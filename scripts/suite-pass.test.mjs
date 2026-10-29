import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { treeKeyOf } from "./suite-pass.mjs";

const SCRIPT = join(import.meta.dirname, "suite-pass.mjs");

const REPORT = JSON.stringify({
  testResults: [
    {
      name: "/fixture/src/a.test.ts",
      status: "passed",
      startTime: 0,
      endTime: 2000,
      assertionResults: [{ status: "passed" }],
    },
  ],
});

const FAILED_REPORT = JSON.stringify({
  testResults: [
    {
      name: "/fixture/src/a.test.ts",
      status: "failed",
      startTime: 0,
      endTime: 2000,
      assertionResults: [{ status: "failed" }],
    },
  ],
});

const directories = [];

function temporaryDirectory() {
  const directory = mkdtempSync(join(tmpdir(), "suite-pass-"));
  directories.push(directory);
  return directory;
}

function git(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout;
}

function createFixture(alwaysRun = []) {
  const cwd = temporaryDirectory();
  git(cwd, "init", "--quiet");
  git(cwd, "config", "user.email", "test@example.com");
  git(cwd, "config", "user.name", "Test");
  mkdirSync(join(cwd, ".kanthord"));
  writeFileSync(join(cwd, ".gitignore"), "node_modules/\n");
  writeFileSync(
    join(cwd, ".kanthord", "suite-pass.json"),
    JSON.stringify({ version: 1, always_run: alwaysRun }),
  );
  writeFileSync(join(cwd, "value.txt"), "1\n");
  git(cwd, "add", "-A");
  git(cwd, "commit", "--quiet", "-m", "base");
  return cwd;
}

function commandWriting(countFile, report, exitCode = 0, extra = "true") {
  const reportFile = join(temporaryDirectory(), "report.json");
  writeFileSync(reportFile, report);
  return [
    `echo "$*" >> '${countFile}'`,
    `for argument in "$@"; do case "$argument" in --outputFile.json=*) out="\${argument#--outputFile.json=}";; esac; done`,
    `cp '${reportFile}' "$out"`,
    extra,
    `exit ${exitCode}`,
  ].join("; ");
}

function run(cwd, command, ...flags) {
  const env = { ...process.env, SUITE_PASS_TEST_COMMAND: command };
  delete env.GITHUB_STEP_SUMMARY;
  const result = spawnSync(process.execPath, [SCRIPT, "run", "--job", "check", ...flags], {
    cwd,
    env,
    encoding: "utf8",
  });
  return { status: result.status, output: result.stdout, error: result.stderr };
}

function lines(file) {
  return existsSync(file) ? readFileSync(file, "utf8").split("\n").filter(Boolean) : [];
}

const storeOf = (cwd) => join(cwd, "node_modules", ".cache", "suite-pass", "records.json");

const writtenAtOf = (cwd) =>
  Object.values(JSON.parse(readFileSync(storeOf(cwd), "utf8")).records)[0].written_at;

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("suite-pass run", { timeout: 60_000 }, () => {
  it("a tree with a matching record runs no test", () => {
    const cwd = createFixture();
    const countFile = join(temporaryDirectory(), "count");
    const command = commandWriting(countFile, REPORT);
    const first = run(cwd, command, "--write");
    const before = writtenAtOf(cwd);
    const second = run(cwd, command, "--write");
    expect(first.status).toBe(0);
    expect(first.output).toContain("Floor: none");
    expect(first.output).toContain("Record: miss");
    expect(first.output).toContain("Saved share: 0%");
    expect(second.status).toBe(0);
    expect(second.output).toContain("Record: hit");
    expect(second.output).toContain("Saved share: 100%");
    expect(lines(countFile)).toHaveLength(1);
    expect(writtenAtOf(cwd)).toBe(before);
  });

  it("a new commit runs the tests again", () => {
    const cwd = createFixture();
    const countFile = join(temporaryDirectory(), "count");
    const command = commandWriting(countFile, REPORT);
    run(cwd, command, "--write");
    writeFileSync(join(cwd, "value.txt"), "2\n");
    git(cwd, "commit", "--quiet", "-am", "change");
    const second = run(cwd, command, "--write");
    expect(second.output).toContain("Record: miss");
    expect(lines(countFile)).toHaveLength(2);
  });

  it("a file of always_run runs on a matching record", () => {
    const cwd = createFixture(["src/a.test.ts"]);
    const countFile = join(temporaryDirectory(), "count");
    const command = commandWriting(countFile, REPORT);
    run(cwd, command, "--write");
    const second = run(cwd, command, "--write");
    const [first, again] = lines(countFile);
    expect(second.status).toBe(0);
    expect(second.output).toContain("Record: hit");
    expect(second.output).toContain("Saved share: 0%");
    expect(first).not.toContain("src/a.test.ts");
    expect(again).toContain("src/a.test.ts");
    expect(lines(countFile)).toHaveLength(2);
  });

  it("a dirty or untracked tree writes no record", () => {
    const cwd = createFixture();
    const countFile = join(temporaryDirectory(), "count");
    const command = commandWriting(countFile, REPORT);
    writeFileSync(join(cwd, "untracked.txt"), "x\n");
    const untracked = run(cwd, command, "--write");
    expect(untracked.status).toBe(2);
    rmSync(join(cwd, "untracked.txt"));
    writeFileSync(join(cwd, "value.txt"), "changed\n");
    const modified = run(cwd, command, "--write");
    expect(modified.status).toBe(2);
    expect(existsSync(storeOf(cwd))).toBe(false);
    expect(lines(countFile)).toHaveLength(0);
  });

  it("a dirty tree without --write runs the tests", () => {
    const cwd = createFixture();
    const countFile = join(temporaryDirectory(), "count");
    const command = commandWriting(countFile, REPORT);
    run(cwd, command, "--write");
    writeFileSync(join(cwd, "value.txt"), "changed\n");
    const dirty = run(cwd, command);
    expect(dirty.status).toBe(0);
    expect(dirty.output).toContain("Record: miss");
    expect(lines(countFile)).toHaveLength(2);
  });

  it("a run that dirties the tree writes no record", () => {
    const cwd = createFixture();
    const countFile = join(temporaryDirectory(), "count");
    const command = commandWriting(countFile, REPORT, 0, `touch '${join(cwd, "created.txt")}'`);
    const result = run(cwd, command, "--write");
    expect(result.status).toBe(2);
    expect(existsSync(storeOf(cwd))).toBe(false);
  });

  it("a run on a matching record that dirties the tree exits 2", () => {
    const cwd = createFixture(["src/a.test.ts"]);
    const countFile = join(temporaryDirectory(), "count");
    run(cwd, commandWriting(countFile, REPORT), "--write");
    const before = writtenAtOf(cwd);
    const dirtying = commandWriting(countFile, REPORT, 0, `touch '${join(cwd, "created.txt")}'`);
    const result = run(cwd, dirtying, "--write");
    expect(result.status).toBe(2);
    expect(result.error).toContain("the working tree is not clean");
    expect(writtenAtOf(cwd)).toBe(before);
  });

  it("a failed run writes no record", () => {
    const cwd = createFixture();
    const countFile = join(temporaryDirectory(), "count");
    const failed = run(cwd, commandWriting(countFile, FAILED_REPORT, 1), "--write");
    expect(failed.status).toBe(1);
    expect(existsSync(storeOf(cwd))).toBe(false);
  });

  it("the full flag runs the tests and writes a record", () => {
    const cwd = createFixture();
    const countFile = join(temporaryDirectory(), "count");
    const command = commandWriting(countFile, REPORT);
    run(cwd, command, "--write");
    const before = writtenAtOf(cwd);
    const full = run(cwd, command, "--write", "--full");
    expect(full.status).toBe(0);
    expect(full.output).toContain("Saved share: 0%");
    expect(lines(countFile)).toHaveLength(2);
    const store = JSON.parse(readFileSync(storeOf(cwd), "utf8"));
    expect(Object.values(store.records)).toHaveLength(1);
    expect(writtenAtOf(cwd)).not.toBe(before);
  });

  it("a configuration of another shape exits 2", () => {
    const cwd = createFixture();
    writeFileSync(join(cwd, ".kanthord", "suite-pass.json"), JSON.stringify({ version: 2 }));
    git(cwd, "commit", "--quiet", "-am", "bad");
    const result = run(cwd, "true", "--write");
    expect(result.status).toBe(2);
  });
});

describe("treeKeyOf", () => {
  const toolchain = { node: "24.17.0", pnpm: "11.24.0" };

  it("gives a SHA-256 hex digest", () => {
    expect(treeKeyOf("tree", toolchain)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes with the tree id", () => {
    expect(treeKeyOf("tree-a", toolchain)).not.toBe(treeKeyOf("tree-b", toolchain));
  });

  it("the key changes with the Node.js version and the pnpm version", () => {
    const key = treeKeyOf("tree", toolchain);
    expect(treeKeyOf("tree", { ...toolchain, node: "24.18.0" })).not.toBe(key);
    expect(treeKeyOf("tree", { ...toolchain, pnpm: "11.25.0" })).not.toBe(key);
    expect(treeKeyOf("tree", { ...toolchain })).toBe(key);
  });
});
