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
