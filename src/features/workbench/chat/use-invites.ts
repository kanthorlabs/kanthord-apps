import { useCallback, useEffect, useState } from "react";

import { listInvites } from "@/api/resources/workbench";
import type { WorkbenchInvite } from "@/api/types";
import type { DataListStatus } from "@/components/data-list";
import { asApiError } from "@/hooks/use-resource";

export interface InvitesState {
  readonly invites: readonly WorkbenchInvite[];
  readonly status: DataListStatus;
  readonly error: string | null;
  readonly shared: boolean;
  readonly reload: () => void;
}

export function useInvites(sessionId: string): InvitesState {
  const [invites, setInvites] = useState<readonly WorkbenchInvite[]>([]);
  const [status, setStatus] = useState<DataListStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    listInvites(sessionId).then(
      (items) => {
        if (!live) return;
        setInvites(items);
        setError(null);
        setStatus("ready");
      },
      (cause: unknown) => {
        if (!live) return;
        setError(asApiError(cause).message);
        setStatus("error");
      },
    );
    return () => {
      live = false;
    };
  }, [sessionId, nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  return { invites, status, error, shared: invites.length > 0, reload };
}
