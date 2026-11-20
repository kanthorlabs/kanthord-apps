import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SCRIPT_SOURCE = join(import.meta.dirname, "openapi-copy.mjs");

let root;
let appsDir;
let engineDir;

function git(args) {
  const result = spawnSync("git", ["-C", engineDir, ...args], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  return result.stdout.trim();
}

function writeEngineFile(relativePath, content) {
  const path = join(engineDir, relativePath);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, content);
}

function commitEngine() {
  git(["add", "-A"]);
  git(["-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "-m", "fixture"]);
  return git(["rev-parse", "HEAD"]);
}

function runCopy(dir) {
  return spawnSync("node", [join(appsDir, "scripts", "openapi-copy.mjs"), dir], {
    encoding: "utf8",
    timeout: 30000,
  });
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "openapi-copy-"));
  appsDir = join(root, "apps");
  engineDir = join(root, "engine");
  mkdirSync(join(appsDir, "scripts"), { recursive: true });
  copyFileSync(SCRIPT_SOURCE, join(appsDir, "scripts", "openapi-copy.mjs"));
  mkdirSync(engineDir);
  git(["init", "--quiet"]);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("openapi-copy", () => {
  it("copies the index, each operation file and the engine commit", () => {
    writeEngineFile("static/openapi.yaml", "paths: {}\n");
    writeEngineFile("static/openapi/svc/one.yaml", "one: 1\n");
    writeEngineFile("static/openapi/shared/components.yaml", "components: {}\n");
    const commit = commitEngine();

    const result = runCopy(engineDir);

    expect(result.status).toBe(0);
    const target = join(appsDir, "test", "openapi");
    expect(readFileSync(join(target, "openapi.yaml"), "utf8")).toBe("paths: {}\n");
    expect(readFileSync(join(target, "openapi", "svc", "one.yaml"), "utf8")).toBe("one: 1\n");
    expect(readFileSync(join(target, "openapi", "shared", "components.yaml"), "utf8")).toBe(
      "components: {}\n",
    );
    expect(readFileSync(join(target, "engine-commit"), "utf8")).toBe(`${commit}\n`);
  });

  it("drops an operation file that the source no longer holds", () => {
    writeEngineFile("static/openapi.yaml", "paths: {}\n");
    writeEngineFile("static/openapi/svc/one.yaml", "one: 1\n");
    writeEngineFile("static/openapi/svc/two.yaml", "two: 2\n");
    commitEngine();
    expect(runCopy(engineDir).status).toBe(0);
    const removed = join(appsDir, "test", "openapi", "openapi", "svc", "two.yaml");
    expect(existsSync(removed)).toBe(true);

    rmSync(join(engineDir, "static", "openapi", "svc", "two.yaml"));
    commitEngine();
    const result = runCopy(engineDir);

    expect(result.status).toBe(0);
    expect(existsSync(removed)).toBe(false);
    expect(existsSync(join(appsDir, "test", "openapi", "openapi", "svc", "one.yaml"))).toBe(true);
  });

  it("refuses a directory with no static/openapi.yaml", () => {
    const result = runCopy(engineDir);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(`No engine OpenAPI file at ${engineDir}/static/openapi.yaml.`);
    expect(existsSync(join(appsDir, "test", "openapi"))).toBe(false);
  });
});
