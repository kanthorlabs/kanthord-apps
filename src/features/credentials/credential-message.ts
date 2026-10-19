import type { ApiError } from "@/api/errors";
import { failureReasonHintOf } from "@/lib/failure-reason";

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
    "This platform does not accept this entry method. An OAuth platform takes its credential through a sign-in. An ssh credential enters through Create SSH key.",
  "credential.login.pending":
    "Another sign-in of yours for this platform is pending. Finish it, or wait until it expires 15 minutes after its start.",
  "credential.login.not_found":
    "The sign-in session does not exist. It ended, or the daemon restarted. Start a new sign-in.",
  "credential.login.value_not_awaited": "The sign-in does not wait for a code now.",
  "credential.login.mode_unsupported":
    "The platform does not support this sign-in mode. Choose another mode.",
  "credential.login.browser_unavailable":
    "Browser sign-in works only from the server host. Choose Headless (device code).",
  "llm.lifecycle.stopped": "The LLM component stopped and accepts no sign-in. Restart the daemon.",
  "system.pagination.cursor_invalid": "The page cursor is no longer valid. Reload the list.",
  "project.bindings.repository.credential_required":
    "Open a pull request requires a credential. Add a GitHub credential to the binding.",
  "project.bindings.repository.action_unsupported":
    "GitLab and Bitbucket do not support open a pull request or a credential binding. Remove the credential and choose another action.",
  "repository.credential.ssh_key_legacy":
    "This SSH credential holds no key that the server generated. Use Rotate key to generate one.",
  "repository.host_key.host_unsupported":
    "The host is in no SSH host set of a platform. Use the host of the platform, for example github.com.",
  "project.bindings.worker.tags_invalid":
    "A tag is malformed or repeated. Use lower-case dotted tags, each at most 64 bytes, each once.",
};

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

function nameConflictMessage(details: unknown): string {
  const holder = isRecord(details) && typeof details["id"] === "string" ? details["id"] : null;
  const base = "A credential with this name already exists. Choose another name.";
  return holder === null ? base : `${base} The holder is ${holder}.`;
}

function hostOf(details: unknown): string | null {
  return isRecord(details) && typeof details["host"] === "string" ? details["host"] : null;
}

function scanFailedMessage(details: unknown): string {
  const host = hostOf(details);
  const subject = host === null ? "the host" : host;
  return `The server cannot read the host key of ${subject}. Check the network of the server, then try again.`;
}

function hostKeyChangedMessage(details: unknown): string {
  const host = hostOf(details);
  const fingerprint =
    isRecord(details) && typeof details["fingerprint"] === "string" ? details["fingerprint"] : null;
  const base = `The host key of ${host ?? "the host"} changed after the scan.`;
  const now = fingerprint === null ? "" : ` The host now presents ${fingerprint}.`;
  return `${base}${now} Compare the fingerprint with the published one, then pin again.`;
}

function unpinnedMessage(details: unknown): string {
  const host = hostOf(details);
  return `The server holds no host key for ${host ?? "the address host"}. Pin the host key, then try again.`;
}

function nodeUnmatchedMessage(details: unknown): string {
  const ids = isRecord(details) && Array.isArray(details["node_ids"]) ? details["node_ids"] : [];
  const base =
    "The change leaves a node with no matching worker binding. Keep a binding whose worker and tags match each listed node.";
  return ids.length === 0 ? base : `${base} Nodes: ${ids.map(String).join(", ")}.`;
}

function sshUnreachableMessage(details: unknown): string {
  const hint =
    failureReasonHintOf(details) ?? "Check the address and the SSH credential. Then try again.";
  return `The server cannot read the repository. ${hint}`;
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

function field(entry: Readonly<Record<string, unknown>>, key: string): string | null {
  const value = entry[key];
  return typeof value === "string" ? value : null;
}

interface DependentGroup {
  readonly key: string;
  readonly title: string;
  readonly label: (entry: Readonly<Record<string, unknown>>) => string | null;
}

const DEPENDENT_GROUPS: readonly DependentGroup[] = [
  {
    key: "agent_providers",
    title: "agent providers",
    label: (entry) => {
      const agent = field(entry, "agent_name");
      const provider = field(entry, "provider_name");
      return agent === null || provider === null ? null : `${agent} (provider ${provider})`;
    },
  },
  {
    key: "bindings",
    title: "project bindings",
    label: (entry) => {
      const binding = field(entry, "binding_id");
      const project = field(entry, "project_id");
      return binding === null || project === null ? null : `${binding} of ${project}`;
    },
  },
  { key: "inbounds", title: "inbounds", label: (entry) => field(entry, "inbound_id") },
];

function dependentLabel(group: DependentGroup, entry: unknown): string {
  return (isRecord(entry) ? group.label(entry) : null) ?? JSON.stringify(entry);
}

function inUseMessage(details: unknown): string {
  const base =
    "A dependent still uses this credential. Remove or change each dependent first, then archive the credential.";
  if (!isRecord(details)) return base;
  const lines = DEPENDENT_GROUPS.flatMap((group) => {
    const entries = details[group.key];
    if (!Array.isArray(entries) || entries.length === 0) return [];
    return [`${group.title}: ${entries.map((entry) => dependentLabel(group, entry)).join(", ")}`];
  });
  return lines.length === 0 ? base : `${base} Dependents: ${lines.join("; ")}.`;
}

export function credentialMessage(cause: ApiError): string {
  if (cause.detail === "credential.credential.archived") {
    return "This credential is archived. An archive is final, and the name stays taken.";
  }
  if (cause.detail === "credential.name.conflict") return nameConflictMessage(cause.details);
  if (cause.detail === "llm.metadata.model_in_use") return modelInUseMessage(cause.details);
  if (cause.detail === "credential.credential.in_use") return inUseMessage(cause.details);
  if (cause.detail === "repository.host_key.scan_failed") return scanFailedMessage(cause.details);
  if (cause.detail === "repository.host_key.changed") return hostKeyChangedMessage(cause.details);
  if (cause.detail === "repository.host_key.unpinned") return unpinnedMessage(cause.details);
  if (cause.detail === "project.bindings.worker.node_unmatched") {
    return nodeUnmatchedMessage(cause.details);
  }
  if (cause.detail === "project.bindings.repository.ssh_unreachable") {
    return sshUnreachableMessage(cause.details);
  }
  return MESSAGES[cause.detail] ?? cause.message;
}
