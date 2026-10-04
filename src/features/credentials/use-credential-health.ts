import { useCallback, useRef, useState } from "react";

import { readHealthReport } from "@/api/resources/gateway";
import type { HealthResourceMap } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";
import { credentialMessage } from "./credential-message";

export type CredentialHealthState =
  | { readonly status: "idle" }
  | { readonly status: "checking" }
  | { readonly status: "ready"; readonly entries: HealthResourceMap; readonly checkedAt: number }
  | { readonly status: "failed"; readonly message: string };

export interface CredentialHealth {
  readonly state: CredentialHealthState;
  readonly verify: () => void;
}

export type HealthFailureHandler = (message: string, retry: () => void) => void;

export function useCredentialHealth(onFailure: HealthFailureHandler): CredentialHealth {
  const [state, setState] = useState<CredentialHealthState>({ status: "idle" });
  const checking = useRef(false);

  const verify = useCallback(
    function run() {
      if (checking.current) return;
      checking.current = true;
      setState({ status: "checking" });
      readHealthReport().then(
        (report) => {
          checking.current = false;
          setState({
            status: "ready",
            entries: report.shared.custody.global,
            checkedAt: Date.now(),
          });
        },
        (cause: unknown) => {
          checking.current = false;
          const message = credentialMessage(asApiError(cause));
          setState({ status: "failed", message });
          onFailure(message, run);
        },
      );
    },
    [onFailure],
  );

  return { state, verify };
}
