import { useCallback, useState } from "react";

import {
  abortWorkbenchRun,
  approveWorkbenchCall,
  sendWorkbenchMessage,
} from "@/api/resources/workbench";
import type { WorkbenchMessageDelivery } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";
import type { SnapshotPatch } from "./use-session-events";

export type ChatActionCause = "send" | "abort" | "approve";

export interface ChatActionFailure {
  readonly cause: ChatActionCause;
  readonly toolCallId?: string;
  readonly code: string;
  readonly message: string;
}

export interface ChatActionsState {
  readonly failure: ChatActionFailure | null;
  readonly busy: boolean;
  readonly send: (text: string, delivery: WorkbenchMessageDelivery) => Promise<boolean>;
  readonly abort: () => void;
  readonly approve: (toolCallId: string, approved: boolean) => void;
}

export function useChatActions(
  sessionId: string,
  patchSnapshot: (patch: SnapshotPatch) => void,
  refill: (texts: readonly string[]) => void,
  initialFailure: ChatActionFailure | null = null,
): ChatActionsState {
  const [failure, setFailure] = useState<ChatActionFailure | null>(initialFailure);
  const [busy, setBusy] = useState(false);

  const perform = useCallback(
    async <T>(
      cause: ChatActionCause,
      action: () => Promise<T>,
      onDone: (answer: T) => void,
      toolCallId?: string,
    ): Promise<boolean> => {
      setFailure(null);
      setBusy(true);
      try {
        onDone(await action());
        return true;
      } catch (failed) {
        const error = asApiError(failed);
        setFailure({ cause, toolCallId, code: error.code, message: error.message });
        return false;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const send = useCallback(
    (text: string, delivery: WorkbenchMessageDelivery) =>
      perform(
        "send",
        () => sendWorkbenchMessage(sessionId, text, delivery),
        (answer) => {
          refill(answer.cleared.map((cleared) => cleared.text));
          if (answer.queued_message_id === null) {
            patchSnapshot({ run_active: true, error_message: null, queue: [] });
            return;
          }
          const queued = { id: answer.queued_message_id, text };
          patchSnapshot((current) => ({ queue: [...current.queue, queued] }));
        },
      ),
    [perform, sessionId, patchSnapshot, refill],
  );

  const abort = useCallback(() => {
    void perform(
      "abort",
      () => abortWorkbenchRun(sessionId),
      (answer) => {
        refill(answer.cleared.map((cleared) => cleared.text));
        patchSnapshot({ run_active: false, pending_approval: null, queue: [] });
      },
    );
  }, [perform, sessionId, patchSnapshot, refill]);

  const approve = useCallback(
    (toolCallId: string, approved: boolean) => {
      void perform(
        "approve",
        () => approveWorkbenchCall(sessionId, toolCallId, approved),
        () => patchSnapshot({ pending_approval: null }),
        toolCallId,
      );
    },
    [perform, sessionId, patchSnapshot],
  );

  return { failure, busy, send, abort, approve };
}
