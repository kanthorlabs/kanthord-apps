import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Credential, CredentialPlatformEntry } from "@/api/types";
import { useCredentialPlatforms } from "@/features/credentials/use-credential-platforms";
import {
  useCredentialRotate,
  type CredentialRotateState,
} from "@/features/credentials/use-credential-rotate";
import { platformEntryOf } from "@/lib/credential-platforms";

const EMPTY_CREDENTIAL: Credential = { name: "", platform: "", revisions: [] };

export interface BindingCredentialState {
  readonly createOpen: boolean;
  readonly openCreate: () => void;
  readonly closeCreate: () => void;
  readonly onCreated: (name: string) => void;
  readonly selectedCredential: Credential;
  readonly selectedEntry: CredentialPlatformEntry | null;
  readonly rotate: CredentialRotateState;
}

export function useBindingCredential(
  credentials: readonly Credential[],
  reload: () => void,
  credentialName: string,
  onChangeName: (name: string) => void,
): BindingCredentialState {
  const [createOpen, setCreateOpen] = useState(false);

  const reloadRef = useRef(reload);
  const onChangeNameRef = useRef(onChangeName);

  useEffect(() => {
    reloadRef.current = reload;
    onChangeNameRef.current = onChangeName;
  });

  const platforms = useCredentialPlatforms("repository");

  const selectedCredential = useMemo(
    () => credentials.find((c) => c.name === credentialName) ?? EMPTY_CREDENTIAL,
    [credentials, credentialName],
  );

  const selectedEntry = useMemo(
    () =>
      platformEntryOf(
        platforms.data,
        selectedCredential.platform === "" ? null : selectedCredential.platform,
      ),
    [platforms.data, selectedCredential.platform],
  );

  const rotate = useCredentialRotate("repository", selectedCredential, selectedEntry, reload);

  const openCreate = useCallback(() => setCreateOpen(true), []);
  const closeCreate = useCallback(() => setCreateOpen(false), []);

  const onCreated = useCallback((name: string) => {
    setCreateOpen(false);
    reloadRef.current();
    onChangeNameRef.current(name);
  }, []);

  return {
    createOpen,
    openCreate,
    closeCreate,
    onCreated,
    selectedCredential,
    selectedEntry,
    rotate,
  };
}
