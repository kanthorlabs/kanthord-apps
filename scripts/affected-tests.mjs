import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { parseArgs } from "node:util";

const MAX_LIST_ENTRIES = 10000;
const MAX_TEXT_BYTES = 1024;
const MAX_REASON_BYTES = 256;
const RUN_REPORTERS = ["--reporter=default", "--reporter=json"];

const GLOBAL_INPUTS = new Set([
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
]);

const INERT_DIRECTORIES = ["docs/", ".agents/", ".github/", ".husky/", ".opencode/", "mock/"];

const INERT_FILES = new Set([
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
]);

const GIT_STATUSES = { A: "added", M: "modified", T: "modified", D: "deleted", R: "renamed" };

const isSourcePath = (path) => path.startsWith("src/") || path.startsWith("test/");

const isInertPath = (path) =>
  INERT_DIRECTORIES.some((directory) => path.startsWith(directory)) ||
  INERT_FILES.has(path) ||
  (!path.includes("/") && path.endsWith(".md"));

export function classify(changes) {
  const entries = changes.flatMap(({ path, status, previous_path }) => {
    const current = { path, removed: status === "deleted" };
    return previous_path ? [current, { path: previous_path, removed: true }] : [current];
  });
  const selectAll = (reason) => ({ selection: "all", reason, paths: [] });

  const globalInput = entries.find((entry) => GLOBAL_INPUTS.has(entry.path));
  if (globalInput) return selectAll(`global input: ${globalInput.path}`);

  const deleted = entries.find((entry) => entry.removed && isSourcePath(entry.path));
  if (deleted) return selectAll(`deleted path: ${deleted.path}`);

  const unknown = entries.find((entry) => !isSourcePath(entry.path) && !isInertPath(entry.path));
  if (unknown) return selectAll(`unknown path: ${unknown.path}`);

  const paths = [
    ...new Set(entries.filter((entry) => isSourcePath(entry.path)).map((entry) => entry.path)),
  ];
  return { selection: paths.length > 0 ? "related" : "none", reason: null, paths };
}

function git(args) {
  const result = spawnSync("git", args, { encoding: "utf8", maxBuffer: 1 << 28 });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr.trim()}`);
  }
  return result.stdout;
}

function parseNameStatus(output) {
  const fields = output.split("\0");
  const files = [];
  let index = 0;
  while (index < fields.length && fields[index] !== "") {
    const code = fields[index][0];
    const status = GIT_STATUSES[code];
    if (!status) throw new Error(`unsupported git status: ${fields[index]}`);
    if (status === "renamed") {
      files.push({ path: fields[index + 2], status, previous_path: fields[index + 1] });
      index += 3;
    } else {
      files.push({ path: fields[index + 1], status });
      index += 2;
    }
  }
  return files;
}

function readChangesFile(changesPath) {
  const changes = JSON.parse(readFileSync(changesPath, "utf8"));
  if (changes.version !== 1 || !Array.isArray(changes.files)) {
    throw new Error(`invalid changes file: ${changesPath}`);
  }
  return changes.files;
}

function computeChanges(base) {
  const mergeBase = git(["merge-base", base, "HEAD"]).trim();
  const tracked = parseNameStatus(
    git(["diff", "--name-status", "-z", "--find-renames", mergeBase]),
  );
  const untracked = git(["ls-files", "--others", "--exclude-standard", "-z"])
    .split("\0")
    .filter((path) => path !== "")
    .map((path) => ({ path, status: "added" }));
  return [...tracked, ...untracked];
}

function vitestBin() {
  const packagePath = createRequire(import.meta.url).resolve("vitest/package.json");
  const { bin } = JSON.parse(readFileSync(packagePath, "utf8"));
  return join(dirname(packagePath), bin.vitest);
}

function runVitest(args, outputDirectory, name) {
  const outputFile = join(outputDirectory, `${name}.json`);
  const result = spawnSync(
    process.execPath,
    [vitestBin(), ...args, ...RUN_REPORTERS, `--outputFile.json=${outputFile}`],
    { stdio: ["ignore", process.stderr.fd, process.stderr.fd] },
  );
  if (result.error) throw result.error;
  if (!existsSync(outputFile)) throw new Error(`vitest wrote no JSON output: ${args[0]} run`);
  return JSON.parse(readFileSync(outputFile, "utf8"));
}

const relativeName = (name) => relative(process.cwd(), name).split(sep).join("/");

const idKey = ({ file, name }) => `${file}\0${name}`;

function failedIds(output) {
  const ids = new Map();
  for (const result of output.testResults) {
    const file = relativeName(result.name);
    const failedAssertions = result.assertionResults.filter(
      (assertion) => assertion.status === "failed",
    );
    const names = failedAssertions.map((assertion) =>
      [...assertion.ancestorTitles, assertion.title].join(" > "),
    );
    if (names.length === 0 && result.status === "failed") names.push(file);
    for (const name of names) ids.set(idKey({ file, name }), { file, name });
  }
  return ids;
}

function rerunFailedFiles(failed, outputDirectory) {
  const files = [...new Set([...failed.values()].map((id) => id.file))];
  const stillFailed = new Set();
  files.forEach((file, index) => {
    const rerun = failedIds(runVitest(["run", file], outputDirectory, `rerun-${index}`));
    for (const key of rerun.keys()) stillFailed.add(key);
  });
  const flaky = [];
  const confirmed = [];
  for (const [key, id] of failed) (stillFailed.has(key) ? confirmed : flaky).push(id);
  return { failed: confirmed, flaky };
}

function cutText(text, maxBytes) {
  if (Buffer.byteLength(text) <= maxBytes) return text;
  let cut = "";
  for (const character of text) {
    if (Buffer.byteLength(cut + character) > maxBytes) break;
    cut += character;
  }
  return cut;
}

const compareText = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

const compareIds = (left, right) =>
  compareText(left.file, right.file) || compareText(left.name, right.name);

const cutId = (id) => ({
  file: cutText(id.file, MAX_TEXT_BYTES),
  name: cutText(id.name, MAX_TEXT_BYTES),
});

const cutList = (list) => list.slice(0, MAX_LIST_ENTRIES);

function buildReport({ selection, reason, tests, failed, flaky }) {
  return {
    version: 1,
    selection,
    reason: reason === null ? null : cutText(reason, MAX_REASON_BYTES),
    tests: cutList(tests.sort(compareText)).map((test) => cutText(test, MAX_TEXT_BYTES)),
    failed: cutList(failed.sort(compareIds)).map(cutId),
    flaky: cutList(flaky.sort(compareIds)).map(cutId),
    excluded_e2e: [],
  };
}

function selectAndRun(classification, outputDirectory) {
  const { selection, reason, paths } = classification;
  if (selection === "none") return { selection, reason, tests: [], failed: [], flaky: [] };
  const args =
    selection === "related" ? ["related", "--run", "--passWithNoTests", ...paths] : ["run"];
  const output = runVitest(args, outputDirectory, "main");
  const tests = output.testResults.map((result) => relativeName(result.name));
  const { failed, flaky } = rerunFailedFiles(failedIds(output), outputDirectory);
  return { selection, reason, tests, failed, flaky };
}

function main() {
  const { values } = parseArgs({ options: { base: { type: "string", default: "origin/main" } } });
  const changesPath = process.env.KANTHORD_CHANGES;
  const files = changesPath ? readChangesFile(changesPath) : computeChanges(values.base);
  const outputDirectory = mkdtempSync(join(tmpdir(), "affected-tests-"));
  try {
    const report = buildReport(selectAndRun(classify(files), outputDirectory));
    const line = JSON.stringify(report);
    const reportPath = process.env.KANTHORD_AFFECTED_REPORT;
    if (reportPath) writeFileSync(reportPath, `${line}\n`);
    process.stdout.write(`${line}\n`);
    process.exitCode = report.failed.length === 0 ? 0 : 1;
  } finally {
    rmSync(outputDirectory, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  try {
    main();
  } catch (error) {
    console.error(error);
    process.exitCode = 2;
  }
}
