import type { InstructionFile, InstructionFileSource } from "@/api/types";

const SHORT_COMMIT_LENGTH = 7;

export const INSTRUCTION_FILE_NAMES: Readonly<Record<InstructionFileSource, string>> = {
  agents_md: "AGENTS.md",
  agents_local_md: "AGENTS.local.md",
  claude_md: "CLAUDE.md",
  claude_local_md: "CLAUDE.local.md",
};

export function shortCommit(commit: string): string {
  return commit.slice(0, SHORT_COMMIT_LENGTH);
}

export function absentFilesLabel(count: number): string {
  return `Show ${count} absent ${count === 1 ? "file" : "files"}`;
}

export function holdsNoInstructionFile(files: readonly InstructionFile[]): boolean {
  return files.every((file) => file.state === "absent");
}

export function instructionFileNamesText(): string {
  return Object.values(INSTRUCTION_FILE_NAMES).join(", ");
}
