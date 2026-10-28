import { useCallback, useState } from "react";
import { toast } from "sonner";

import type { InstanceCredentialCopy } from "@/api/types";
import {
  type CredentialLoginState,
  useCredentialLogin,
} from "@/features/credentials/form/use-credential-login";
import type { InstanceCredentialRow } from "./use-instance-page";

export interface InstanceSignInState {
  readonly copy: InstanceCredentialCopy | null;
  readonly copyCode: boolean;
  readonly login: CredentialLoginState;
  readonly start: (row: InstanceCredentialRow) => void;
  readonly close: () => void;
  readonly submit: () => void;
}

export function useInstanceSignIn(instanceName: string, reload: () => void): InstanceSignInState {
  const [row, setRow] = useState<InstanceCredentialRow | null>(null);
  const modes = (row?.entry?.login_modes ?? []).filter((mode) => mode !== "browser");

  const finish = useCallback(
    (name: string) => {
      setRow(null);
      toast.success(`Stored a new revision of ${name} for ${instanceName}.`);
      reload();
    },
    [instanceName, reload],
  );

  const login = useCredentialLogin("llm", modes, finish, instanceName, false);
  const restartLogin = login.restart;
  const clearStartError = login.clearStartError;

  const start = useCallback(
    (next: InstanceCredentialRow) => {
      restartLogin();
      clearStartError();
      setRow(next);
    },
    [restartLogin, clearStartError],
  );

  const close = useCallback(() => {
    if (login.inProgress || login.starting) return;
    setRow(null);
  }, [login.inProgress, login.starting]);

  const submit = useCallback(() => {
    if (row === null) return;
    login.start(row.copy.name, row.copy.platform);
  }, [row, login]);

  return {
    copy: row?.copy ?? null,
    copyCode: modes.includes("copy_code"),
    login,
    start,
    close,
    submit,
  };
}
