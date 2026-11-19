import type { AgentVariant } from "@/api/types";

export const VARIANT_NAME_INVALID = "agent.variant.name_invalid";
export const VARIANT_NAME_TAKEN = "agent.variant.name_taken";
export const VARIANT_NOT_FOUND = "agent.variant.not_found";
export const VARIANT_REVISION_CONFLICT = "agent.variant.revision_conflict";
export const VARIANT_IN_USE = "agent.variant.in_use";
export const VALIDATION_FAILED = "gateway.request.validation_failed";

export const VARIANT_NAME_RULE = "1 to 40 letters, digits, spaces, _ or -, starting with a letter.";
export const IN_USE_LINE = "This variant has sessions. Rename it or change its instruction.";
export const INSTRUCTION_LINE = "The instruction is blank or above 32768 bytes.";

export const NEXT_SESSION_NOTICE = "Takes effect at the next agent session";

const VARIANT_NAME = /^\p{L}[\p{L}\p{Nd} _-]{0,39}$/u;

export interface VariantRefusal {
  readonly code: string;
  readonly detail: string;
  readonly details: unknown;
  readonly message: string;
  readonly status: number;
}

export type VariantLine = { readonly code: string | null; readonly message: string };

export type VariantFailure =
  | { readonly field: "name"; readonly line: VariantLine }
  | { readonly field: "instruction"; readonly line: VariantLine }
  | { readonly field: "form"; readonly line: VariantLine };

export function variantNameValid(name: string): boolean {
  return VARIANT_NAME.test(name);
}

export function variantPath(agentName: string, variantId: string): string {
  return `/agents/${encodeURIComponent(agentName)}/variants/${encodeURIComponent(variantId)}`;
}

function holdsInstructionPath(details: unknown): boolean {
  if (!Array.isArray(details)) return false;
  return details.some((issue: unknown) => {
    if (typeof issue !== "object" || issue === null) return false;
    const path: unknown = Reflect.get(issue, "path");
    return (
      Array.isArray(path) && path.length === 2 && path[0] === "body" && path[1] === "instruction"
    );
  });
}

export function variantFailureOf(error: VariantRefusal): VariantFailure {
  if (error.detail === VARIANT_NAME_INVALID || error.detail === VARIANT_NAME_TAKEN) {
    return { field: "name", line: { code: error.detail, message: error.message } };
  }
  if (error.detail === VALIDATION_FAILED && holdsInstructionPath(error.details)) {
    return { field: "instruction", line: { code: VALIDATION_FAILED, message: INSTRUCTION_LINE } };
  }
  const code = error.status === 0 || error.detail === "" ? error.code : error.detail;
  return { field: "form", line: { code, message: error.message } };
}

export function currentVariantOf(details: unknown): AgentVariant | null {
  if (typeof details !== "object" || details === null) return null;
  const row: unknown = Reflect.get(details, "current");
  if (typeof row !== "object" || row === null) return null;
  const id: unknown = Reflect.get(row, "id");
  const agentName: unknown = Reflect.get(row, "agent_name");
  const displayName: unknown = Reflect.get(row, "display_name");
  const instruction: unknown = Reflect.get(row, "instruction");
  const revision: unknown = Reflect.get(row, "revision");
  if (
    typeof id !== "string" ||
    typeof agentName !== "string" ||
    typeof displayName !== "string" ||
    typeof instruction !== "string" ||
    typeof revision !== "number"
  ) {
    return null;
  }
  return {
    id,
    agent_name: agentName,
    display_name: displayName,
    instruction,
    revision,
  };
}
