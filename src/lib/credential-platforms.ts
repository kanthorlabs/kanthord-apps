import type {
  CredentialPlatform,
  CredentialPlatformEntry,
  CredentialPlatformList,
} from "@/api/types";

const PLATFORM_LABELS: Readonly<Record<string, string>> = {
  "anthropic-subscription": "Anthropic (Claude Pro/Max)",
};

export function platformLabel(platform: string): string {
  return PLATFORM_LABELS[platform] ?? platform;
}

export function platformEntryOf(
  list: CredentialPlatformList | null,
  platform: string | null,
): CredentialPlatformEntry | null {
  return list?.items.find((entry) => entry.platform === platform) ?? null;
}

export function platformIdsOf(list: CredentialPlatformList | null): readonly CredentialPlatform[] {
  return (list?.items ?? []).map((entry) => entry.platform);
}
