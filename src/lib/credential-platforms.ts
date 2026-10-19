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

function checkedBeforeSave(entry: CredentialPlatformEntry): boolean {
  return entry.verifiable && entry.secret_shape !== "oauth";
}

function signsIn(entry: CredentialPlatformEntry): boolean {
  return entry.secret_shape === "oauth";
}

export function platformGroupsOf(list: CredentialPlatformList | null): readonly PlatformGroup[] {
  const items = list?.items ?? [];
  const idsOf = (keep: (entry: CredentialPlatformEntry) => boolean) =>
    items.filter(keep).map((entry) => entry.platform);
  const groups: readonly PlatformGroup[] = [
    { value: "Checked before save", items: idsOf(checkedBeforeSave) },
    { value: "Sign in with an account", items: idsOf(signsIn) },
    {
      value: "Not checked before save",
      items: idsOf((entry) => !checkedBeforeSave(entry) && !signsIn(entry)),
    },
  ];
  return groups.filter((group) => group.items.length > 0);
}
