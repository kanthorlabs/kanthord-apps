import type { RepositoryBindingConfig } from "@/api/types";
import type { RepositoryDraft } from "./binding-draft";

export function instructionReadAllowed(
  saved: RepositoryBindingConfig | null,
  draft: RepositoryDraft,
): boolean {
  return (
    saved !== null &&
    saved.address === draft.address.trim() &&
    saved.ssh_credential === draft.sshCredential.trim() &&
    saved.strategy.base_branch === draft.baseBranch.trim()
  );
}
