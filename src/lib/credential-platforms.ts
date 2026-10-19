import type {
  CredentialPlatform,
  CredentialPlatformEntry,
  CredentialPlatformList,
} from "@/api/types";

export function platformEntryOf(
  list: CredentialPlatformList | null,
  platform: string | null,
): CredentialPlatformEntry | null {
  return list?.items.find((entry) => entry.platform === platform) ?? null;
}

export function platformIdsOf(list: CredentialPlatformList | null): readonly CredentialPlatform[] {
  return (list?.items ?? []).map((entry) => entry.platform);
}

export interface PlatformGroup {
  readonly value: string;
  readonly items: readonly CredentialPlatform[];
}

export function platformGroupsOf(list: CredentialPlatformList | null): readonly PlatformGroup[] {
  const items = list?.items ?? [];
  const groups: readonly PlatformGroup[] = [
    {
      value: "Checked before save",
      items: items.filter((entry) => entry.verifiable).map((entry) => entry.platform),
    },
    {
      value: "Other",
      items: items.filter((entry) => !entry.verifiable).map((entry) => entry.platform),
    },
  ];
  return groups.filter((group) => group.items.length > 0);
}
