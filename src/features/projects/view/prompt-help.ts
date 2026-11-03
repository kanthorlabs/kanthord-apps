import type { PromptTarget } from "@/lib/binding-draft";

export const INSTRUCTION_FILE_HELP =
  "Name one file, for example AGENTS.md. Its text joins the default standard of every agent. KanthorD reads no nested file. Leave the field empty when the file holds advice or instructions for an interactive tool.";

export const RULE_HELP =
  "Each work-product sentence is a rule. The reviewer judges a violation as a blocker. A rule about the method, the tools, the repository operations or the release is guidance: the reviewer reports a violation as a suggestion.";

export const REVIEWER_HELP =
  "Put each rule that the reviewer judges into the Repository prompt, so the coder reads it too. Use this text only to relax the judgement of a rule.";

export function promptTitle(target: PromptTarget): string {
  return target === "repository" ? "Repository prompt" : `Binding prompt of ${target}`;
}

export function promptHelp(target: PromptTarget): readonly string[] {
  return target === "re@1" ? [RULE_HELP, REVIEWER_HELP] : [RULE_HELP];
}
