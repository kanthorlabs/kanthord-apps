import type { ApiError } from "@/api/errors";

export const REVISION_CONFLICT = "credential.revision.conflict";

const MESSAGES: Readonly<Record<string, string>> = {
  [REVISION_CONFLICT]:
    "The credential changed after this page read it. Reload it, review the newest revision, then try again.",
  "llm.metadata.base_url_fixed":
    "A metadata edit cannot change the base URL. Rotate the secret to set a new base URL.",
  "credential.revision.newest_live":
    "The newest live revision cannot be revoked. Rotate the secret first, then revoke the older revision.",
  "credential.revision.ended": "The revision already ended through a revoke or a drain.",
  "credential.revision.not_found": "The revision does not exist.",
  "credential.credential.not_found": "The credential does not exist.",
  "credential.input.invalid":
    "Custody refused the secret or the metadata. Check each field against the rules of the platform.",
  "credential.check.unsupported":
    "This platform has no check before the save. Save the credential, then use Verify.",
  "credential.platform.unsupported": "Custody does not support this platform.",
  "credential.entry.unsupported":
    "This platform does not accept this entry method. An OAuth platform takes its credential through a sign-in.",
  "credential.login.pending":
    "Another sign-in of yours for this platform is pending. Finish it, or wait until it expires 15 minutes after its start.",
  "credential.login.not_found":
    "The sign-in session does not exist. It ended, or the daemon restarted. Start a new sign-in.",
  "credential.login.value_not_awaited": "The sign-in does not wait for a code now.",
  "credential.login.mode_unsupported":
    "The platform does not support this sign-in mode. Choose another mode.",
  "llm.lifecycle.stopped": "The LLM component stopped and accepts no sign-in. Restart the daemon.",
  "system.pagination.cursor_invalid": "The page cursor is no longer valid. Reload the list.",
  "project.bindings.repository.credential_required":
    "Open a pull request requires a credential. Add a GitHub credential to the binding.",
  "project.bindings.repository.action_unsupported":
    "GitLab and Bitbucket do not support open a pull request or a credential binding. Remove the credential and choose another action.",
  "project.bindings.repository.ssh_host_mismatch":
    "The address host does not match the SSH credential host. Use an address whose host equals the SSH credential host.",
  "repository.credential.ssh_drift":
    "The SSH credential changed since the binding was created. Re-verify or update the binding.",
  "repository.credential.ssh_identity_ambiguous":
    "The SSH credential has no single identity file. Add IdentitiesOnly yes and one IdentityFile to the Host block in ~/.ssh/config.",
  "repository.credential.ssh_config_unreadable":
    "The server cannot read ~/.ssh/config. Check its permissions and syntax.",
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

function dependentLabel(entry: unknown): string {
  if (typeof entry === "string") return entry;
  if (isRecord(entry)) {
    for (const key of ["name", "id"]) {
      const value = entry[key];
      if (typeof value === "string") return value;
    }
  }
  return JSON.stringify(entry);
}

function inUseMessage(details: unknown): string {
  const groups = isRecord(details)
    ? Object.entries(details).filter(([, value]) => Array.isArray(value) && value.length > 0)
    : [];
  const base =
    "A dependent still uses this credential. Remove or change each dependent first, then archive the credential.";
  if (groups.length === 0) return base;
  const lines = groups.map(
    ([group, entries]) => `${group}: ${(entries as unknown[]).map(dependentLabel).join(", ")}`,
  );
  return `${base} Dependents: ${lines.join("; ")}.`;
}

export function credentialMessage(cause: ApiError): string {
  if (cause.detail === "credential.credential.archived") {
    return "This credential is archived. An archive is final, and the name stays taken.";
  }
  if (cause.detail === "credential.name.conflict") return nameConflictMessage(cause.details);
  if (cause.detail === "llm.metadata.model_in_use") return modelInUseMessage(cause.details);
  if (cause.detail === "credential.credential.in_use") return inUseMessage(cause.details);
  return MESSAGES[cause.detail] ?? cause.message;
}
