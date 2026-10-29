import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";

const CONFIG_PATH = ".kanthord/suite-pass.json";
const STORE_PATH = join("node_modules", ".cache", "suite-pass", "records.json");
const MAX_RECORDS = 20000;
const RUN_REPORTERS = ["--reporter=default", "--reporter=json"];
const WHOLE_TREE = ".";

class Refusal extends Error {}

export function treeKeyOf(treeId, toolchain) {
  const canonical = JSON.stringify({ node: toolchain.node, pnpm: toolchain.pnpm, tree: treeId });
  return createHash("sha256").update(canonical).digest("hex");
}

function git(args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Refusal(`git ${args.join(" ")} failed: ${result.stderr}`);
  return result.stdout;
}

function readConfig() {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  } catch (error) {
    throw new Refusal(`invalid ${CONFIG_PATH}: ${error.message}`);
  }
  const keys = parsed !== null && typeof parsed === "object" ? Object.keys(parsed).sort() : [];
  const valid =
    keys.join() === "always_run,version" &&
    parsed.version === 1 &&
    Array.isArray(parsed.always_run) &&
    parsed.always_run.every((path) => typeof path === "string" && path !== "");
  if (!valid) throw new Refusal(`invalid ${CONFIG_PATH}: expected version 1 and always_run`);
  return parsed.always_run;
}

function readToolchain() {
  const result = spawnSync("pnpm", ["--version"], { encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Refusal(`pnpm --version failed: ${result.stderr}`);
  return { node: process.versions.node, pnpm: result.stdout.trim() };
}

function readStore() {
  try {
    const store = JSON.parse(readFileSync(STORE_PATH, "utf8"));
    const valid =
      store !== null &&
      typeof store === "object" &&
      store.version === 1 &&
      store.records !== null &&
      typeof store.records === "object" &&
      !Array.isArray(store.records);
    return valid ? store.records : {};
  } catch {
    return {};
  }
}

function writeStore(records) {
  const newest = Object.entries(records)
    .sort(([, left], [, right]) => String(right.written_at).localeCompare(String(left.written_at)))
    .slice(0, MAX_RECORDS);
  mkdirSync(dirname(STORE_PATH), { recursive: true });
  writeFileSync(
    STORE_PATH,
    `${JSON.stringify({ version: 1, records: Object.fromEntries(newest) })}\n`,
  );
}

function vitestBin() {
  const packagePath = createRequire(import.meta.url).resolve("vitest/package.json");
  const { bin } = JSON.parse(readFileSync(packagePath, "utf8"));
  return join(dirname(packagePath), bin.vitest);
}

function runTests(files) {
  const directory = mkdtempSync(join(tmpdir(), "suite-pass-"));
  const outputFile = join(directory, "report.json");
  const arguments_ = [...files, ...RUN_REPORTERS, `--outputFile.json=${outputFile}`];
  const command = process.env.SUITE_PASS_TEST_COMMAND;
  const result = command
    ? spawnSync("bash", ["-c", command, "suite-pass", ...arguments_], {
        stdio: ["ignore", process.stderr.fd, process.stderr.fd],
      })
    : spawnSync(process.execPath, [vitestBin(), "run", ...arguments_], {
        stdio: ["ignore", process.stderr.fd, process.stderr.fd],
      });
  try {
    if (result.error) throw result.error;
    const report = existsSync(outputFile) ? JSON.parse(readFileSync(outputFile, "utf8")) : null;
    return { exitCode: result.status, report };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function testSeconds(report) {
  const milliseconds = report.testResults.reduce(
    (sum, result) => sum + Math.max(0, result.endTime - result.startTime),
    0,
  );
  return milliseconds / 1000;
}

function passed({ exitCode, report }) {
  return (
    exitCode === 0 &&
    report !== null &&
    report.testResults.every(
      (result) =>
        result.status !== "failed" &&
        result.assertionResults.every((assertion) => assertion.status !== "failed"),
    )
  );
}

const isDirty = () => git(["status", "--porcelain", "--untracked-files=all"]) !== "";

function requireCleanTree() {
  if (isDirty()) throw new Refusal("the working tree is not clean: --write needs a clean tree");
}

function savedShare({ hit, full, record, alwaysRunSeconds }) {
  if (!hit || full) return 0;
  if (record.seconds <= 0) return alwaysRunSeconds === 0 ? 100 : 0;
  return Math.round((Math.max(0, record.seconds - alwaysRunSeconds) / record.seconds) * 100);
}

function writeSummary(job, hit, share) {
  const text = [
    `### Suite pass: ${job}`,
    "",
    "Floor: none",
    `Record: ${hit ? "hit" : "miss"}`,
    `Saved share: ${share}%`,
    "",
  ].join("\n");
  process.stdout.write(text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
}

function execute({ job, write, full }) {
  const alwaysRun = readConfig();
  const key = treeKeyOf(git(["rev-parse", "HEAD^{tree}"]).trim(), readToolchain());
  const records = readStore();
  const record = records[key];
  if (write) requireCleanTree();
  const hit = record !== undefined && !isDirty();
  const fullRun = !hit || full;
  const files = fullRun ? [] : alwaysRun;
  let alwaysRunSeconds = 0;
  let outcome;
  if (fullRun || files.length > 0) {
    outcome = runTests(files);
    if (!passed(outcome)) return 1;
    alwaysRunSeconds = testSeconds(outcome.report);
  }
  if (write && fullRun) {
    requireCleanTree();
    records[key] = {
      file: WHOLE_TREE,
      seconds: alwaysRunSeconds,
      written_at: new Date().toISOString(),
    };
    writeStore(records);
  }
  writeSummary(job, hit, savedShare({ hit, full, record, alwaysRunSeconds }));
  return 0;
}

function main(argv) {
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      job: { type: "string" },
      write: { type: "boolean", default: false },
      full: { type: "boolean", default: false },
    },
  });
  if (positionals.length !== 1 || positionals[0] !== "run" || !values.job) {
    throw new Refusal("usage: suite-pass.mjs run --job <name> [--write] [--full]");
  }
  return execute(values);
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  }
}
