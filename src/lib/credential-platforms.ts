import type {
  CredentialPlatform,
  CredentialPlatformEntry,
  CredentialPlatformKind,
  CredentialPlatformList,
} from "@/api/types";

export interface PlatformGroupItems {
  readonly value: string;
  readonly items: readonly CredentialPlatform[];
}

const PLATFORM_KIND_LABELS: Readonly<Record<CredentialPlatformKind, string>> = {
  git: "Git",
  llm: "LLM",
  storage: "Storage",
};

export function platformKindLabelOf(kind: string): string {
  return PLATFORM_KIND_LABELS[kind as CredentialPlatformKind] ?? kind;
}

export function platformEntryOf(
  list: CredentialPlatformList | null,
  platform: string | null,
): CredentialPlatformEntry | null {
  for (const group of list?.items ?? []) {
    const entry = group.platforms.find((candidate) => candidate.platform === platform);
    if (entry !== undefined) return entry;
  }
  return null;
}

export function platformGroupsOf(
  list: CredentialPlatformList | null,
): readonly PlatformGroupItems[] {
  return (list?.items ?? []).map((group) => ({
    value: group.kind,
    items: group.platforms.map((entry) => entry.platform),
  }));
}
