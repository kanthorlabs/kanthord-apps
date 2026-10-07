import { useCallback, useState } from "react";

import {
  abortWorkbenchRun,
  approveWorkbenchCall,
  sendWorkbenchMessage,
} from "@/api/resources/workbench";
import type { WorkbenchRunSnapshot } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";

export interface ChatActionsState {
  readonly failure: string | null;
  readonly busy: boolean;
  readonly send: (text: string) => Promise<boolean>;
  readonly abort: () => void;
  readonly approve: (toolCallId: string, approved: boolean) => void;
}

export function useChatActions(
  sessionId: string,
  patchSnapshot: (patch: Partial<WorkbenchRunSnapshot>) => void,
): ChatActionsState {
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const perform = useCallback(
    async (action: () => Promise<unknown>, onDone: () => void): Promise<boolean> => {
      setFailure(null);
      setBusy(true);
      try {
        await action();
        onDone();
        return true;
      } catch (cause) {
        setFailure(asApiError(cause).message);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const send = useCallback(
    (text: string) =>
      perform(
        () => sendWorkbenchMessage(sessionId, text),
        () => patchSnapshot({ run_active: true, error_message: null }),
      ),
    [perform, sessionId, patchSnapshot],
  );

  const abort = useCallback(() => {
    void perform(
      () => abortWorkbenchRun(sessionId),
      () => patchSnapshot({ run_active: false, pending_approval: null }),
    );
  }, [perform, sessionId, patchSnapshot]);

  const approve = useCallback(
    (toolCallId: string, approved: boolean) => {
      void perform(
        () => approveWorkbenchCall(sessionId, toolCallId, approved),
        () => patchSnapshot({ pending_approval: null }),
      );
    },
    [perform, sessionId, patchSnapshot],
  );

  return { failure, busy, send, abort, approve };
}
