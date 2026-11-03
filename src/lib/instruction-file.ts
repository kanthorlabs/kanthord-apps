import type { InstructionFileCheck, InstructionFileReason } from "@/api/types";

import { failureReasonHint } from "./failure-reason";

export interface InstructionFileView {
  readonly text: string;
  readonly problem: boolean;
}

const INVALID_REASONS: Readonly<Partial<Record<InstructionFileReason, string>>> = {
  too_large: "the file is larger than 32768 bytes",
  not_utf8: "the file is not UTF-8 text",
  unreadable: "the server cannot read the file",
  control_character: "the file holds a control character, for example a carriage return",
};

const BASE_BRANCH_ABSENT = "base_branch_absent";
const BASE_BRANCH_ABSENT_HINT = "The remote does not hold the base branch.";

function unreachableHint(reason: InstructionFileReason | null): string {
  if (reason === BASE_BRANCH_ABSENT) return BASE_BRANCH_ABSENT_HINT;
  return reason === null ? "" : failureReasonHint(reason, "repository");
}

export function instructionFileView(check: InstructionFileCheck): InstructionFileView {
  const { path, commit, reason } = check;
  const at = commit === null ? "the base head" : commit;
  switch (check.state) {
    case "present":
      return { text: `${path} found at ${at}.`, problem: false };
    case "absent":
      return {
        text: `${path} absent at ${at}. The agents read no instruction file until the file exists.`,
        problem: false,
      };
    case "invalid":
      return {
        text: `${path} invalid: ${(reason === null ? undefined : INVALID_REASONS[reason]) ?? reason ?? "unknown reason"}. Save refuses this file.`,
        problem: true,
      };
    case "unreachable":
      return { text: `${path} unreachable. ${unreachableHint(reason)}`.trim(), problem: true };
  }
}
