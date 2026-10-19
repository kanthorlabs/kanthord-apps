import type { CredentialComponent } from "@/api/types";

export const ENABLE_AGENTS_HASH = "#enable-agents";

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
