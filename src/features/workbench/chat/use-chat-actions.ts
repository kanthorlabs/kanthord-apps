import { useCallback, useRef, useState } from "react";

import {
  abortWorkbenchRun,
  approveWorkbenchCall,
  removeQueuedWorkbenchMessage,
  sendWorkbenchMessage,
} from "@/api/resources/workbench";
import type { ApiError } from "@/api/errors";
import type { WorkbenchMessageDelivery, WorkbenchQueuedMessage } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";
import type { SnapshotPatch } from "./use-session-events";

const QUEUED_NOT_FOUND = "workbench.session.queued_message_not_found";
const ALREADY_STARTED = "The message already started.";

type Refill = (texts: readonly string[]) => void;

const NO_REFILL: Refill = () => undefined;

export type ChatActionCause = "send" | "abort" | "approve" | "queue";

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
  readonly remove: (item: WorkbenchQueuedMessage) => void;
  readonly edit: (item: WorkbenchQueuedMessage) => void;
  readonly bindRefill: (refill: Refill) => () => void;
}

function failureOf(
  cause: ChatActionCause,
  error: ApiError,
  toolCallId: string | undefined,
): ChatActionFailure {
  if (cause === "queue" && error.detail === QUEUED_NOT_FOUND) {
    return { cause, code: QUEUED_NOT_FOUND, message: ALREADY_STARTED };
  }
  return { cause, toolCallId, code: error.code, message: error.message };
}

export function useChatActions(
  sessionId: string,
  patchSnapshot: (patch: SnapshotPatch) => void,
  initialFailure: ChatActionFailure | null = null,
): ChatActionsState {
  const [failure, setFailure] = useState<ChatActionFailure | null>(initialFailure);
  const [busy, setBusy] = useState(false);
  const refillRef = useRef<Refill>(NO_REFILL);

  const bindRefill = useCallback((refill: Refill) => {
    refillRef.current = refill;
    return () => {
      refillRef.current = NO_REFILL;
    };
  }, []);

  const refillCleared = useCallback((cleared: readonly WorkbenchQueuedMessage[]) => {
    refillRef.current(cleared.map((message) => message.text));
  }, []);

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
        setFailure(failureOf(cause, asApiError(failed), toolCallId));
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
          refillCleared(answer.cleared);
          if (answer.queued_message_id === null) {
            patchSnapshot({ run_active: true, error_message: null, queue: [] });
            return;
          }
          const queued = { id: answer.queued_message_id, text };
          if (delivery === "replace") {
            patchSnapshot({ queue: [queued] });
            return;
          }
          patchSnapshot((current) => ({ queue: [...current.queue, queued] }));
        },
      ),
    [perform, sessionId, patchSnapshot, refillCleared],
  );

  const abort = useCallback(() => {
    void perform(
      "abort",
      () => abortWorkbenchRun(sessionId),
      (answer) => {
        refillCleared(answer.cleared);
        patchSnapshot({ run_active: false, pending_approval: null, queue: [] });
      },
    );
  }, [perform, sessionId, patchSnapshot, refillCleared]);

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

  const dequeue = useCallback(
    (item: WorkbenchQueuedMessage, returnToComposer: boolean) => {
      void perform(
        "queue",
        () => removeQueuedWorkbenchMessage(sessionId, item.id),
        () => {
          patchSnapshot((current) => ({
            queue: current.queue.filter((held) => held.id !== item.id),
          }));
          if (returnToComposer) refillRef.current([item.text]);
        },
      );
    },
    [perform, sessionId, patchSnapshot],
  );

  const remove = useCallback((item: WorkbenchQueuedMessage) => dequeue(item, false), [dequeue]);
  const edit = useCallback((item: WorkbenchQueuedMessage) => dequeue(item, true), [dequeue]);

  return { failure, busy, send, abort, approve, remove, edit, bindRefill };
}
