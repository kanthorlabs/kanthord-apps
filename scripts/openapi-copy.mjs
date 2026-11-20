import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { argv, exit, stderr } from "node:process";

const TARGET_DIR = join(import.meta.dirname, "..", "test", "openapi");

function refuse(message) {
  stderr.write(`${message}\n`);
  exit(1);
}

function engineCommit(engineDir) {
  const result = spawnSync("git", ["-C", engineDir, "rev-parse", "HEAD"], { encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) refuse(`git rev-parse HEAD failed in ${engineDir}: ${result.stderr}`);
  return result.stdout.trim();
}

const engineArg = argv[2];
if (!engineArg) refuse("Usage: node scripts/openapi-copy.mjs <engine dir>");

const engineDir = resolve(engineArg);
const source = join(engineDir, "static", "openapi.yaml");
if (!existsSync(source)) refuse(`No engine OpenAPI file at ${engineArg}/static/openapi.yaml.`);

const commit = engineCommit(engineDir);
rmSync(TARGET_DIR, { recursive: true, force: true });
mkdirSync(TARGET_DIR, { recursive: true });
cpSync(source, join(TARGET_DIR, "openapi.yaml"));
cpSync(join(engineDir, "static", "openapi"), join(TARGET_DIR, "openapi"), { recursive: true });
writeFileSync(join(TARGET_DIR, "engine-commit"), `${commit}\n`);
