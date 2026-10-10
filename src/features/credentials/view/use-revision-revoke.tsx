import { useCallback, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { revokeCredentialRevision } from "@/api/resources/credentials";
import type { Credential, CredentialComponent, CredentialRevision } from "@/api/types";
import { RecordName } from "@/components/record-name";
import { isRevocable } from "@/lib/credential-revisions";
import { writeFailureOf } from "../write-failure";

export interface RevisionRevokeState {
  readonly target: CredentialRevision | null;
  readonly consequence: ReactNode;
  readonly saferPath: string;
  readonly error: string | null;
  readonly revoking: boolean;
  readonly canRevoke: (revision: CredentialRevision) => boolean;
  readonly request: (revision: CredentialRevision) => void;
  readonly cancel: () => void;
  readonly confirm: () => void;
}

export function useRevisionRevoke(
  component: CredentialComponent,
  credential: Credential,
  reload: () => void,
): RevisionRevokeState {
  const [target, setTarget] = useState<CredentialRevision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);

  const canRevoke = useCallback(
    (revision: CredentialRevision) => isRevocable(credential, revision),
    [credential],
  );

  const request = useCallback(
    (revision: CredentialRevision) => {
      if (!isRevocable(credential, revision)) return;
      setError(null);
      setTarget(revision);
    },
    [credential],
  );

  const cancel = useCallback(() => {
    if (revoking) return;
    setTarget(null);
    setError(null);
  }, [revoking]);

  const confirm = useCallback(() => {
    if (revoking || target === null) return;
    if (!isRevocable(credential, target)) {
      setTarget(null);
      return;
    }
    setRevoking(true);
    setError(null);
    revokeCredentialRevision(component, credential.name, target.revision).then(
      () => {
        setRevoking(false);
        toast.success(`Revoked revision ${target.revision} of ${credential.name}.`);
        setTarget(null);
        reload();
      },
      (cause: unknown) => {
        setRevoking(false);
        setError(writeFailureOf(cause).message);
        reload();
      },
    );
  }, [revoking, target, component, credential, reload]);

  const revision = target?.revision ?? 0;
  return {
    target,
    consequence: (
      <>
        Revision {revision} ends at once. Every execution that pins it is refused at its next use of{" "}
        <RecordName>{credential.name}</RecordName>. A revoke cannot be undone.
      </>
    ),
    saferPath: `Keep revision ${revision}. Custody ends it on its own after the last execution that pins it lets it go.`,
    error,
    revoking,
    canRevoke,
    request,
    cancel,
    confirm,
  };
}
