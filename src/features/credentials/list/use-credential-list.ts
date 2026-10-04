import { useCallback, useState } from "react";

import { listCredentialPage } from "@/api/resources/credentials";
import type { Credential, CredentialPlatform, CredentialPlatformList } from "@/api/types";
import { useCursorPages, type CursorPages } from "@/hooks/use-cursor-pages";
import {
  platformEntryOf,
  platformGroupsOf,
  type PlatformGroupItems,
} from "@/lib/credential-platforms";
import { useCredentialPlatforms } from "../use-credential-platforms";

export const ALL_PLATFORMS = "all";

export interface CredentialList {
  readonly pages: CursorPages<Credential>;
  readonly platforms: CredentialPlatformList | null;
  readonly groups: readonly PlatformGroupItems[];
  readonly platform: CredentialPlatform | null;
  readonly includeArchived: boolean;
  readonly selectPlatform: (value: string | null) => void;
  readonly setIncludeArchived: (value: boolean) => void;
}

export function useCredentialList(): CredentialList {
  const platforms = useCredentialPlatforms();
  const [platform, setPlatform] = useState<CredentialPlatform | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);
  const pages = useCursorPages(
    (cursor) => listCredentialPage(platform, cursor, includeArchived),
    [platform, includeArchived],
  );
  const selectPlatform = useCallback(
    (value: string | null) => {
      if (value !== null) setPlatform(platformEntryOf(platforms.data, value)?.platform ?? null);
    },
    [platforms.data],
  );
  return {
    pages,
    platforms: platforms.data,
    groups: [{ value: "", items: [ALL_PLATFORMS] }, ...platformGroupsOf(platforms.data)],
    platform,
    includeArchived,
    selectPlatform,
    setIncludeArchived,
  };
}
