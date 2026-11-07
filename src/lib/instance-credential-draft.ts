import type { CredentialCreateBody, CredentialPlatformEntry } from "@/api/types";
import {
  createBodyOf,
  type DraftResult,
  editMetadataOf,
  type MetadataDraft,
  OPENAI_COMPATIBLE,
  type SecretDraft,
} from "./credential-draft";

export function instanceCopyBodyOf(
  name: string,
  entry: CredentialPlatformEntry,
  secret: SecretDraft,
  metadata: MetadataDraft,
  holders: readonly string[],
): DraftResult<CredentialCreateBody> {
  const body = createBodyOf(name, entry, secret, metadata);
  if (entry.platform !== OPENAI_COMPATIBLE) {
    return body.ok ? { ok: true, value: { ...body.value, holders } } : body;
  }
  const models = editMetadataOf(
    entry,
    { base_url: metadata.fields["base_url"] ?? "", models: [] },
    metadata,
  );
  const modelErrors = models.ok
    ? metadata.models.length === 0
      ? { models: "Add one model or more. A copy of a worker instance gets no model list." }
      : {}
    : models.errors;
  if (!body.ok || !models.ok || Object.keys(modelErrors).length > 0) {
    return { ok: false, errors: { ...(body.ok ? {} : body.errors), ...modelErrors } };
  }
  return { ok: true, value: { ...body.value, metadata: models.value, holders } };
}

export function holderGroupsOf(
  instances: readonly { readonly name: string; readonly worker: string }[],
  exclude: string,
): readonly { readonly worker: string; readonly names: readonly string[] }[] {
  const workers = [...new Set(instances.map((instance) => instance.worker))].sort();
  return workers
    .map((worker) => ({
      worker,
      names: instances
        .filter((instance) => instance.worker === worker && instance.name !== exclude)
        .map((instance) => instance.name),
    }))
    .filter((group) => group.names.length > 0);
}

export interface SealTargetGroup {
  readonly label: string;
  readonly names: readonly string[];
}

export function sealTargetGroupsOf(
  machines: readonly { readonly name: string; readonly ended_at: number | null }[],
  instances: readonly {
    readonly name: string;
    readonly worker: string;
    readonly placement: string;
    readonly ended_at: number | null;
  }[],
  exclude: string,
): readonly SealTargetGroup[] {
  const machineNames = machines
    .filter((machine) => machine.ended_at === null && machine.name !== exclude)
    .map((machine) => machine.name)
    .sort();
  const workers = holderGroupsOf(
    instances.filter((instance) => instance.ended_at === null && instance.placement === "worker"),
    exclude,
  ).map((group) => ({ label: group.worker, names: group.names }));
  return machineNames.length === 0
    ? workers
    : [{ label: "Machines", names: machineNames }, ...workers];
}

export interface CopyHolder {
  readonly name: string;
  readonly kind: "instance" | "machine";
}

export function copySignInNote(kind: CopyHolder["kind"], copyCode: boolean): string {
  const mode = copyCode ? "copy-code" : "device-code";
  return kind === "machine"
    ? `An instance of the machine runs this sign-in in ${mode} mode and seals the result to the key of the machine. An instance of the machine must be connected.`
    : `The instance runs this sign-in in ${mode} mode and seals the result to its own key. The instance must be connected.`;
}
