import type { Credential, CredentialRevision } from "@/api/types";

export function newestLiveRevision(credential: Credential): CredentialRevision | null {
  let newest: CredentialRevision | null = null;
  for (const revision of credential.revisions) {
    if (revision.endedAt !== null) continue;
    if (newest === null || revision.revision > newest.revision) newest = revision;
  }
  return newest;
}

export function isArchived(credential: Credential): boolean {
  return credential.revisions.every((revision) => revision.endedAt !== null);
}

export function archiveTime(credential: Credential): number | null {
  if (!isArchived(credential)) return null;
  let latest: number | null = null;
  for (const revision of credential.revisions) {
    if (revision.endedAt !== null && (latest === null || revision.endedAt > latest)) {
      latest = revision.endedAt;
    }
  }
  return latest;
}

export function isRevocable(credential: Credential, revision: CredentialRevision): boolean {
  if (revision.endedAt !== null) return false;
  return newestLiveRevision(credential)?.revision !== revision.revision;
}

export function revisionsNewestFirst(credential: Credential): readonly CredentialRevision[] {
  return [...credential.revisions].sort((left, right) => right.revision - left.revision);
}
