import { useCallback, useState } from "react";

import { rotateClientSecret } from "@/api/resources/projects";

export interface RotateSecretState {
  readonly pendingIdentityId: string | null;
  readonly executing: boolean;
  readonly revealedSecret: string | null;
  readonly requestRotate: (projectId: string, identityId: string) => void;
  readonly confirmRotate: () => Promise<void>;
  readonly cancelRotate: () => void;
  readonly dismissSecret: () => void;
}

export function useRotateSecret(): RotateSecretState {
  const [pendingIdentityId, setPendingIdentityId] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null);

  const requestRotate = useCallback((projectId: string, identityId: string) => {
    setPendingProjectId(projectId);
    setPendingIdentityId(identityId);
  }, []);

  const confirmRotate = useCallback(async () => {
    if (pendingIdentityId === null || pendingProjectId === null) return;
    setExecuting(true);
    try {
      const result = await rotateClientSecret(pendingProjectId, pendingIdentityId);
      setRevealedSecret(result.clientSecret);
    } finally {
      setExecuting(false);
      setPendingIdentityId(null);
      setPendingProjectId(null);
    }
  }, [pendingIdentityId, pendingProjectId]);

  const cancelRotate = useCallback(() => {
    setPendingIdentityId(null);
    setPendingProjectId(null);
  }, []);

  const dismissSecret = useCallback(() => {
    setRevealedSecret(null);
  }, []);

  return {
    pendingIdentityId,
    executing,
    revealedSecret,
    requestRotate,
    confirmRotate,
    cancelRotate,
    dismissSecret,
  };
}
