import type { Credential, CredentialRevision } from "@/api/types";

export function newestLiveRevision(credential: Credential): CredentialRevision | null {
  let newest: CredentialRevision | null = null;
  for (const revision of credential.revisions) {
    if (revision.endedAt !== null) continue;
    if (newest === null || revision.revision > newest.revision) newest = revision;
  }
  return newest;
}

export function liveRevisionCount(credential: Credential): number {
  return credential.revisions.filter((revision) => revision.endedAt === null).length;
}

export function isArchived(credential: Credential): boolean {
  return credential.revisions.every((revision) => revision.endedAt !== null);
}

export function isRevocable(credential: Credential, revision: CredentialRevision): boolean {
  if (revision.endedAt !== null) return false;
  return newestLiveRevision(credential)?.revision !== revision.revision;
}

export function revisionsNewestFirst(credential: Credential): readonly CredentialRevision[] {
  return [...credential.revisions].sort((left, right) => right.revision - left.revision);
}
