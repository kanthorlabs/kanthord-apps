import { useCallback, useEffect, useState } from "react";

import { listInvites } from "@/api/resources/workbench";
import type { GrantableOperation, WorkbenchInvite, WorkbenchProjectRef } from "@/api/types";
import type { DataListStatus } from "@/components/data-list";
import { asApiError } from "@/hooks/use-resource";
import { lockedProjectsOf } from "@/lib/share-invite";

export interface InvitesState {
  readonly invites: readonly WorkbenchInvite[];
  readonly grantable: readonly GrantableOperation[];
  readonly status: DataListStatus;
  readonly error: string | null;
  readonly shared: boolean;
  readonly lockedProjects: readonly WorkbenchProjectRef[] | null;
  readonly reload: () => void;
}

export function useInvites(sessionId: string): InvitesState {
  const [invites, setInvites] = useState<readonly WorkbenchInvite[]>([]);
  const [grantable, setGrantable] = useState<readonly GrantableOperation[]>([]);
  const [lockedIds, setLockedIds] = useState<readonly string[] | null>(null);
  const [status, setStatus] = useState<DataListStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    listInvites(sessionId).then(
      (answer) => {
        if (!live) return;
        setInvites(answer.items);
        setGrantable(answer.grantable);
        setLockedIds(answer.project_ids);
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

  return {
    invites,
    grantable,
    status,
    error,
    shared: invites.length > 0,
    lockedProjects: lockedProjectsOf(lockedIds, invites),
    reload,
  };
}
