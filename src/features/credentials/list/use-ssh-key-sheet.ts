import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { CREATE_SSH_KEY_HASH } from "@/lib/credential-sections";
import { returnToOf } from "@/lib/return-to";

export interface SshKeySheetState {
  readonly open: boolean;
  readonly show: () => void;
  readonly close: () => void;
  readonly done: () => void;
}

export function useSshKeySheet(reload: () => void): SshKeySheetState {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = returnToOf(location.state);
  const [open, setOpen] = useState(location.hash === CREATE_SSH_KEY_HASH);

  useEffect(() => {
    if (location.hash !== CREATE_SSH_KEY_HASH) return;
    void navigate(
      { pathname: location.pathname, search: location.search },
      { replace: true, state: location.state },
    );
  }, [navigate, location.hash, location.pathname, location.search, location.state]);

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
