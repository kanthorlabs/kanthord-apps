import type { Credential, CredentialComponent } from "@/api/types";

import { agentProviderCredentials } from "./agent-provider-draft";
import { isArchived } from "./credential-revisions";

export const ENABLE_AGENTS_HASH = "#enable-agents";
export const CREATE_SSH_KEY_HASH = "#create-ssh-key";

const SECTION_PATHS: Readonly<Record<CredentialComponent, string>> = {
  llm: "/llm",
  repository: "/repositories",
  storage: "/storage",
};

export function credentialSectionPath(component: CredentialComponent): string {
  return SECTION_PATHS[component];
}

export function credentialDetailPath(component: CredentialComponent, name: string): string {
  return `${SECTION_PATHS[component]}/${encodeURIComponent(name)}`;
}

export function enableAgentsPath(credentials: readonly Credential[] | null): string | null {
  const [provider] = agentProviderCredentials(
    (credentials ?? []).filter((credential) => !isArchived(credential)),
  );
  return provider === undefined
    ? null
    : `${credentialDetailPath("llm", provider.name)}${ENABLE_AGENTS_HASH}`;
}
