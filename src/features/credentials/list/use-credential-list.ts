import { useCallback, useState } from "react";

import { listCredentialPage } from "@/api/resources/credentials";
import { CREDENTIAL_PLATFORMS, type Credential, type CredentialPlatform } from "@/api/types";
import { useCursorPages, type CursorPages } from "@/hooks/use-cursor-pages";

export interface CredentialList {
  readonly pages: CursorPages<Credential>;
  readonly platform: CredentialPlatform | null;
  readonly selectPlatform: (value: string | null) => void;
}

export function useCredentialList(): CredentialList {
  const [platform, setPlatform] = useState<CredentialPlatform | null>(null);
  const pages = useCursorPages((cursor) => listCredentialPage(platform, cursor), [platform]);
  const selectPlatform = useCallback(
    (value: string | null) =>
      setPlatform(CREDENTIAL_PLATFORMS.find((candidate) => candidate === value) ?? null),
    [],
  );
  return { pages, platform, selectPlatform };
}
