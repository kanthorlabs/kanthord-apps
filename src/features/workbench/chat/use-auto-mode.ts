import { useCallback, useState } from "react";

import { setWorkbenchAutoMode } from "@/api/resources/workbench";
import { asApiError } from "@/hooks/use-resource";

export interface AutoModeFailure {
  readonly code: string;
  readonly message: string;
}

export interface AutoModeState {
  readonly pending: boolean;
  readonly failure: AutoModeFailure | null;
  readonly toggle: (enabled: boolean) => Promise<void>;
}

export function useAutoMode(
  sessionId: string,
  onEnabled: (enabled: boolean) => void,
): AutoModeState {
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<AutoModeFailure | null>(null);

  const toggle = useCallback(
    async (enabled: boolean) => {
      setFailure(null);
      setPending(true);
      try {
        onEnabled((await setWorkbenchAutoMode(sessionId, enabled)).enabled);
      } catch (failed) {
        const error = asApiError(failed);
        setFailure({ code: error.code, message: error.message });
      } finally {
        setPending(false);
      }
    },
    [sessionId, onEnabled],
  );

  return { pending, failure, toggle };
}
