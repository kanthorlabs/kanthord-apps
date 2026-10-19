import type { MissionImportViolation } from "@/api/types";

const BINDINGS_INVALID = "mission.node.bindings_invalid";

export type ViolationText =
  | {
      readonly kind: "unknown_binding";
      readonly binding: string;
      readonly current: readonly string[];
    }
  | { readonly kind: "message"; readonly message: string };

function unknownBindingOf(violation: MissionImportViolation): string | null {
  if (violation.code !== BINDINGS_INVALID) return null;
  const { details } = violation;
  if (typeof details !== "object" || details === null || !("binding" in details)) return null;
  return typeof details.binding === "string" ? details.binding : null;
}

export function violationTextOf(
  violation: MissionImportViolation,
  bindingNames: readonly string[],
): ViolationText {
  const binding = unknownBindingOf(violation);
  if (binding === null) return { kind: "message", message: violation.message };
  return { kind: "unknown_binding", binding, current: [...bindingNames].sort() };
}
