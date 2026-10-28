import { statSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";

const ALIAS_PREFIX = "@/";
const sourceRoot = fileURLToPath(new URL("./src/", import.meta.url));
const suffixes = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

const isFile = (path) => statSync(path, { throwIfNoEntry: false })?.isFile() ?? false;

export const interfaceVersion = 2;

export function resolve(source) {
  if (!source.startsWith(ALIAS_PREFIX)) return { found: false };
  const base = resolvePath(sourceRoot, source.slice(ALIAS_PREFIX.length));
  const path = suffixes.map((suffix) => `${base}${suffix}`).find(isFile);
  return path === undefined ? { found: false } : { found: true, path };
}
