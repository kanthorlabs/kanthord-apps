import { useCallback, useRef, useState } from "react";

import { verifyCredential } from "@/api/resources/credentials";
import type { CredentialComponent, HealthEntry } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";
import { credentialMessage } from "./credential-message";

export type CredentialHealthState =
  | { readonly status: "idle" }
  | { readonly status: "checking" }
  | { readonly status: "ready"; readonly entry: HealthEntry; readonly checkedAt: number }
  | { readonly status: "failed"; readonly message: string };

export interface CredentialHealth {
  readonly state: CredentialHealthState;
  readonly verify: () => void;
}

export type HealthFailureHandler = (message: string, retry: () => void) => void;

export function useCredentialHealth(
  component: CredentialComponent,
  name: string,
  onFailure: HealthFailureHandler,
): CredentialHealth {
  const [state, setState] = useState<CredentialHealthState>({ status: "idle" });
  const checking = useRef(false);

  const verify = useCallback(
    function run() {
      if (checking.current) return;
      checking.current = true;
      setState({ status: "checking" });
      verifyCredential(component, name).then(
        (entry) => {
          checking.current = false;
          setState({ status: "ready", entry, checkedAt: Date.now() });
        },
        (cause: unknown) => {
          checking.current = false;
          const message = credentialMessage(asApiError(cause));
          setState({ status: "failed", message });
          onFailure(message, run);
        },
      );
    },
    [component, name, onFailure],
  );

  return { state, verify };
}
