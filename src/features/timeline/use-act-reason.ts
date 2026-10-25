import { useCallback, useState } from "react";

import type { ApiError } from "@/api/errors";
import { readTraceText } from "@/api/resources/tracking";
import { useResource } from "@/hooks/use-resource";

export interface ActReason {
  readonly shown: boolean;
  readonly toggle: () => void;
  readonly text: string | null;
  readonly error: ApiError | null;
  readonly loading: boolean;
}

export function useActReason(traceId: string, textId: string | null): ActReason {
  const [shown, setShown] = useState(false);
  const reason = useResource(
    async () => (shown && textId !== null ? (await readTraceText(traceId, textId)).content : null),
    [traceId, textId, shown],
  );
  const toggle = useCallback(() => setShown((current) => !current), []);
  return {
    shown,
    toggle,
    text: reason.data,
    error: reason.error,
    loading: shown && reason.loading,
  };
}
