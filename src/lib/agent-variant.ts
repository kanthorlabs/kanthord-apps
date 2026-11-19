export const VARIANT_NAME_INVALID = "agent.variant.name_invalid";
export const VARIANT_NAME_TAKEN = "agent.variant.name_taken";
export const VALIDATION_FAILED = "gateway.request.validation_failed";

export const VARIANT_NAME_RULE = "1 to 40 letters, digits, spaces, _ or -, starting with a letter.";
export const INSTRUCTION_LINE = "The instruction is blank or above 32768 bytes.";

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
