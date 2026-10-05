import { useCallback, useState } from "react";

import { listCredentialPage } from "@/api/resources/credentials";
import type {
  Credential,
  CredentialComponent,
  CredentialPlatform,
  CredentialPlatformList,
} from "@/api/types";
import { useCursorPages, type CursorPages } from "@/hooks/use-cursor-pages";
import { platformEntryOf, platformIdsOf } from "@/lib/credential-platforms";
import { useCredentialPlatforms } from "../use-credential-platforms";

export const ALL_PLATFORMS = "all";

export interface CredentialList {
  readonly pages: CursorPages<Credential>;
  readonly platforms: CredentialPlatformList | null;
  readonly platformIds: readonly string[];
  readonly platform: CredentialPlatform | null;
  readonly includeArchived: boolean;
  readonly selectPlatform: (value: string | null) => void;
  readonly setIncludeArchived: (value: boolean) => void;
}

export function useCredentialList(component: CredentialComponent): CredentialList {
  const platforms = useCredentialPlatforms(component);
  const [platform, setPlatform] = useState<CredentialPlatform | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);
  const pages = useCursorPages(
    (cursor) => listCredentialPage(component, platform, cursor, includeArchived),
    [component, platform, includeArchived],
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
    platformIds: [ALL_PLATFORMS, ...platformIdsOf(platforms.data)],
    platform,
    includeArchived,
    selectPlatform,
    setIncludeArchived,
  };
}
