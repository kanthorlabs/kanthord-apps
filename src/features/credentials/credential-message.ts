import type { ApiError } from "@/api/errors";

export const REVISION_CONFLICT = "credential.revision.conflict";

const MESSAGES: Readonly<Record<string, string>> = {
  [REVISION_CONFLICT]:
    "The credential changed after this page read it. Reload it, review the newest revision, then try again.",
  "credential.metadata.base_url_fixed":
    "A metadata edit cannot change the base URL. Rotate the secret to set a new base URL.",
  "credential.revision.newest_live":
    "The newest live revision cannot be revoked. Rotate the secret first, then revoke the older revision.",
  "credential.revision.ended": "The revision already ended through a revoke or a drain.",
  "credential.revision.not_found": "The revision does not exist.",
  "credential.credential.not_found": "The credential does not exist.",
  "credential.input.invalid":
    "Custody refused the secret or the metadata. Check each field against the rules of the platform.",
  "credential.platform.unsupported": "Custody does not support this platform.",
  "credential.entry.unsupported":
    "This platform does not accept this entry method. GitHub Copilot takes its credential through Sign in.",
  "credential.login.pending":
    "Another GitHub Copilot sign-in of yours is pending. Finish it, or wait until it expires 15 minutes after its start.",
  "credential.login.not_found":
    "The sign-in session does not exist. It ended, or the daemon restarted. Start a new sign-in.",
  "credential.login.value_not_awaited": "The sign-in does not wait for a code now.",
  "credential.login.mode_unsupported":
    "GitHub Copilot does not support this sign-in mode. Choose another mode.",
  "custody.lifecycle.stopped": "Custody stopped and accepts no sign-in. Restart the daemon.",
  "system.pagination.cursor_invalid": "The page cursor is no longer valid. Reload the list.",
};

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

function nameConflictMessage(details: unknown): string {
  const holder = isRecord(details) && typeof details["id"] === "string" ? details["id"] : null;
  const base = "A credential with this name already exists. Choose another name.";
  return holder === null ? base : `${base} The holder is ${holder}.`;
}

function modelInUseMessage(details: unknown): string {
  const models = isRecord(details) && Array.isArray(details["models"]) ? details["models"] : [];
  const uses = models.filter(isRecord).map((entry) => {
    const agents = Array.isArray(entry["agents"]) ? entry["agents"].join(", ") : "";
    return `${String(entry["model"])} (agents: ${agents})`;
  });
  const base =
    "An agent still uses a model that the edit removes. Keep the model, or change the agent first.";
  return uses.length === 0 ? base : `${base} In use: ${uses.join("; ")}.`;
}

function inventoryFailedMessage(details: unknown): string {
  const owners =
    isRecord(details) && Array.isArray(details["missingInventories"])
      ? details["missingInventories"].map(String)
      : [];
  return `The health report could not read the inventory of: ${owners.join(", ") || "an owner"}. Try again later.`;
}

export function credentialMessage(cause: ApiError): string {
  if (cause.detail === "credential.name.conflict") return nameConflictMessage(cause.details);
  if (cause.detail === "credential.metadata.model_in_use") return modelInUseMessage(cause.details);
  if (cause.detail === "gateway.healthcheck.inventory_failed") {
    return inventoryFailedMessage(cause.details);
  }
  return MESSAGES[cause.detail] ?? cause.message;
}
