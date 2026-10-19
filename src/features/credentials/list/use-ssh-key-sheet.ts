import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import type { CredentialComponent } from "@/api/types";
import { CREATE_SSH_KEY_HASH } from "@/lib/credential-sections";
import { returnToOf } from "@/lib/return-to";

export interface SshKeySheetState {
  readonly open: boolean;
  readonly show: () => void;
  readonly close: () => void;
  readonly done: () => void;
}

export function useSshKeySheet(
  component: CredentialComponent,
  reload: () => void,
): SshKeySheetState {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = returnToOf(location.state);
  const arrival = component === "repository" && location.hash === CREATE_SSH_KEY_HASH;
  const [open, setOpen] = useState(arrival);

  useEffect(() => {
    if (!arrival) return;
    void navigate(
      { pathname: location.pathname, search: location.search },
      { replace: true, state: location.state },
    );
  }, [arrival, navigate, location.pathname, location.search, location.state]);

  const show = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);

  const done = useCallback(() => {
    setOpen(false);
    if (returnTo !== null) {
      void navigate(returnTo);
      return;
    }
    reload();
  }, [returnTo, navigate, reload]);

  return { open, show, close, done };
}
