import type { ApiError } from "@/api/errors";

export const REVISION_CONFLICT = "worker.machine.revision_conflict";
export const IN_USE = "worker.machine.in_use";
export const NAME_INVALID = "worker.machine.name_invalid";
export const NAME_CONFLICT = "worker.machine.name_conflict";
export const MACHINE_INVALID = "worker.instance.machine_invalid";

const MESSAGES: Readonly<Record<string, string>> = {
  [NAME_INVALID]:
    "The name breaks the form or is reserved. Start with a lowercase letter. Use only lowercase letters, digits and hyphens.",
  "worker.machine.key_invalid": "The public key is not a valid X25519 key.",
  "worker.machine.not_found": "The machine does not exist.",
  [NAME_CONFLICT]:
    "The name is taken by a machine or an instance, live or archived. Choose another name.",
  "worker.machine.key_conflict": "Another machine holds this public key.",
  "worker.machine.archived": "The machine is archived.",
  [MACHINE_INVALID]:
    "The machine does not exist or is archived. Add a machine, or choose a live one.",
};

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

export function instancesOfRefusal(details: unknown): readonly string[] {
  const instances = isRecord(details) ? details["instances"] : undefined;
  return Array.isArray(instances)
    ? instances.filter((item): item is string => typeof item === "string")
    : [];
}

function revisionConflictMessage(details: unknown): string {
  const revision = isRecord(details) ? details["revision"] : undefined;
  const live = typeof revision === "number" ? ` The live revision is ${revision}.` : "";
  return `The machine changed after this page read it.${live} Reload it, review it, then try again.`;
}

function inUseMessage(details: unknown): string {
  const instances = instancesOfRefusal(details);
  const named = instances.length === 0 ? "" : ` Instances: ${instances.join(", ")}.`;
  return `A live instance names the machine. Archive each instance first.${named}`;
}

export function machineMessage(error: ApiError): string {
  if (error.detail === REVISION_CONFLICT) return revisionConflictMessage(error.details);
  if (error.detail === IN_USE) return inUseMessage(error.details);
  return MESSAGES[error.detail] ?? error.message;
}
