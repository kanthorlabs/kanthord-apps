import { createHash } from "node:crypto";

export const BASE_COMMIT = "4f1c2e7a9b3d5f6081a2c4e6f8b0d1e3a5c7e9f1";
export const ENGINE_VERSION = "0.4.0";
export const INSTRUCTION_FILE_TEXT = `# Repository rules

- Every screen offers the same information at 390 px and at 1280 px.
- A test sits beside its unit under src/.`;
export const PROMPT_AGENTS = ["swe@1", "re@1", "env@1"];
export const PROMPT_TEXT_MAX_BYTES = 32768;
export const PATH_MAX_BYTES = 255;

export const digestOf = (text) => createHash("sha256").update(text).digest("hex");

export const headingOf = (part, bindingName, path) => {
  if (part === "instruction_file")
    return `Repository prompt of repository ${bindingName}, file ${path}:`;
  if (part === "repository")
    return `Repository prompt of repository ${bindingName}, set in KanthorD:`;
  if (part === "binding") return `Binding prompt of repository ${bindingName}:`;
  return null;
};

const holdsControlCharacter = (text, allowed) =>
  [...text].some((char) => {
    const code = char.charCodeAt(0);
    return (code < 32 && !allowed.includes(code)) || code === 127;
  });

export const textReasonOf = (text) => {
  if (Buffer.byteLength(text) > PROMPT_TEXT_MAX_BYTES) return "too_large";
  return holdsControlCharacter(text, [9, 10]) ? "control_character" : null;
};

export const pathInvalid = (path) =>
  Buffer.byteLength(path) > PATH_MAX_BYTES ||
  path.includes("\\") ||
  holdsControlCharacter(path, []) ||
  path.split("/").some((segment) => segment === "" || segment === "." || segment === "..");

export const instructionFileAt = (path) => {
  if (path.includes("unreachable"))
    return { state: "unreachable", commit: null, reason: "deadline_exceeded", text: null };
  if (path.includes("absent"))
    return { state: "absent", commit: BASE_COMMIT, reason: null, text: null };
  if (path.includes("invalid"))
    return { state: "invalid", commit: BASE_COMMIT, reason: "control_character", text: null };
  return { state: "present", commit: BASE_COMMIT, reason: null, text: INSTRUCTION_FILE_TEXT };
};

export const finalOf = (parts) =>
  parts.some((part) => part.state !== "resolved")
    ? null
    : parts
        .map((part) => (part.heading === null ? part.text : `${part.heading}\n\n${part.text}`))
        .join("\n\n");
