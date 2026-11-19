import { useCallback, useEffect, useRef, useState } from "react";

import {
  abortWorkbenchRun,
  approveWorkbenchCall,
  forkWorkbenchSession,
  removeQueuedWorkbenchMessage,
  sendWorkbenchMessage,
} from "@/api/resources/workbench";
import type { ApiError } from "@/api/errors";
import type {
  WorkbenchMessageDelivery,
  WorkbenchPendingApproval,
  WorkbenchQueuedMessage,
} from "@/api/types";
import { asApiError } from "@/hooks/use-resource";
import { forkFailureOf } from "@/lib/workbench-fork";
import { hostSessionIdOf } from "@/lib/workbench-sessions";
import type { SnapshotPatch } from "./use-session-events";

const QUEUED_NOT_FOUND = "workbench.session.queued_message_not_found";
const ALREADY_STARTED = "The message already started.";

type Refill = (texts: readonly string[], cleared?: boolean) => void;

const NO_REFILL: Refill = () => undefined;

export type ChatActionCause = "send" | "abort" | "approve" | "queue" | "fork";

export interface ChatActionFailure {
  readonly cause: ChatActionCause;
  readonly toolCallId?: string;
  readonly code: string;
  readonly message: string;
}

export interface ChatActionsState {
  readonly failure: ChatActionFailure | null;
  readonly busy: boolean;
  readonly summarizing: boolean;
  readonly send: (text: string, delivery: WorkbenchMessageDelivery) => Promise<boolean>;
  readonly fork: (text: string) => Promise<boolean>;
  readonly cancelFork: () => void;
  readonly abort: () => void;
  readonly approve: (approval: WorkbenchPendingApproval, approved: boolean) => void;
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

export interface Mention {
  readonly name: string;
  readonly variantId: string | null;
}

export interface SharedMark {
  readonly shared: boolean;
  readonly reload: () => void;
}

const NOT_SHARED: SharedMark = { shared: false, reload: () => undefined };
const UNTAGGED = (): Mention | null => null;
const NO_NOT_HOST = (): void => undefined;
const NO_FORKED = (): void => undefined;

export function useChatActions(
  sessionId: string,
  patchSnapshot: (patch: SnapshotPatch) => void,
  initialFailure: ChatActionFailure | null = null,
  mentionOf: (text: string) => Mention | null = UNTAGGED,
  onNotHost: (hostSessionId: string) => void = NO_NOT_HOST,
  onForked: (forkSessionId: string) => void = NO_FORKED,
  { shared, reload }: SharedMark = NOT_SHARED,
): ChatActionsState {
  const [failure, setFailure] = useState<ChatActionFailure | null>(initialFailure);
  const [busy, setBusy] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const refillRef = useRef<Refill>(NO_REFILL);
  const forkAbortRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      forkAbortRef.current?.abort();
    },
    [],
  );

  const bindRefill = useCallback((refill: Refill) => {
    refillRef.current = refill;
    return () => {
      refillRef.current = NO_REFILL;
    };
  }, []);

  const refillCleared = useCallback((cleared: readonly WorkbenchQueuedMessage[]) => {
    refillRef.current(
      cleared.map((message) => message.text),
      true,
    );
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
        const error = asApiError(failed);
        const hostSessionId = hostSessionIdOf(error);
        if (hostSessionId === null) setFailure(failureOf(cause, error, toolCallId));
        else onNotHost(hostSessionId);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [onNotHost],
  );

  const send = useCallback(
    (text: string, delivery: WorkbenchMessageDelivery) =>
      perform(
        "send",
        () => sendWorkbenchMessage(sessionId, text, delivery),
        (answer) => {
          const expected = shared && mentionOf(text) === null ? "note" : "run";
          if (answer.kind !== expected) reload();
          if (answer.kind === "note") return;
          refillCleared(answer.cleared);
          if (answer.queued_message_id === null) {
            patchSnapshot({ run_active: true, error_message: null, queue: [] });
            return;
          }
          const mention = mentionOf(text);
          const queued = {
            id: answer.queued_message_id,
            text,
            agent_name: answer.agent_name,
            variant_id: mention?.variantId ?? null,
            display_name: mention?.name ?? null,
          };
          if (delivery === "replace") {
            patchSnapshot({ queue: [queued] });
            return;
          }
          patchSnapshot((current) => ({ queue: [...current.queue, queued] }));
        },
      ),
    [perform, sessionId, patchSnapshot, refillCleared, mentionOf, shared, reload],
  );

  const fork = useCallback(
    async (text: string): Promise<boolean> => {
      if (forkAbortRef.current !== null) return false;
      const controller = new AbortController();
      forkAbortRef.current = controller;
      setFailure(null);
      setBusy(true);
      setSummarizing(true);
      try {
        const answer = await forkWorkbenchSession(sessionId, { text, signal: controller.signal });
        onForked(answer.session_id);
        return true;
      } catch (failed) {
        if (!controller.signal.aborted) {
          setFailure({ cause: "fork", ...forkFailureOf(asApiError(failed)) });
        }
        return false;
      } finally {
        forkAbortRef.current = null;
        setSummarizing(false);
        setBusy(false);
      }
    },
    [sessionId, onForked],
  );

  const cancelFork = useCallback(() => forkAbortRef.current?.abort(), []);

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
    (approval: WorkbenchPendingApproval, approved: boolean) => {
      void perform(
        "approve",
        () => approveWorkbenchCall(approval.session_id, approval.tool_call_id, approved),
        () => patchSnapshot({ pending_approval: null }),
        approval.tool_call_id,
      );
    },
    [perform, patchSnapshot],
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

  return {
    failure,
    busy,
    summarizing,
    send,
    fork,
    cancelFork,
    abort,
    approve,
    remove,
    edit,
    bindRefill,
  };
}
