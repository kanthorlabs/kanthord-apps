import type { Credential, SshMetadata } from "@/api/types";
import { newestLiveRevision } from "@/lib/credential-revisions";

export const SSH_PLATFORM = "ssh";

export function sshKeyOf(metadata: Readonly<Record<string, unknown>> | null): SshMetadata | null {
  if (metadata === null) return null;
  const publicKey = metadata["public_key"];
  const fingerprint = metadata["fingerprint"];
  if (typeof publicKey !== "string" || typeof fingerprint !== "string") return null;
  return { public_key: publicKey, fingerprint };
}

export function newestSshKeyOf(credential: Credential): SshMetadata | null {
  return sshKeyOf(newestLiveRevision(credential)?.metadata ?? null);
}
