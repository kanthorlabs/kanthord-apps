import { useCallback, useState } from "react";
import { toast } from "sonner";

import { approveWorkbenchCall } from "@/api/resources/workbench";
import { asApiError } from "@/hooks/use-resource";
import type { ToolApprovalItem } from "@/lib/approval-attention";

import type { BoardReadsState } from "./use-board-reads";

export interface ActFailure {
  readonly text: string;
  readonly retry: () => void;
}

export interface ToolActs {
  readonly need: string | null;
  readonly sending: boolean;
  readonly failure: ActFailure | null;
  readonly approve: () => void;
  readonly reject: () => void;
}

interface ToolContext {
  readonly reload: () => void;
  readonly markActed: (itemId: string) => void;
}

const SESSION_NEED = "Approve needs: the session read.";

export function reportActFailure(
  doing: string,
  subject: string,
  cause: unknown,
  retry: () => void,
): ActFailure {
  const { message } = asApiError(cause);
  toast.error(`${doing} ${subject} failed.`, { description: message });
  return { text: `${doing} ${subject} failed. ${message}`, retry };
}

export function useBoardToolActs(
  item: ToolApprovalItem,
  reads: BoardReadsState,
  { reload, markActed }: ToolContext,
): ToolActs {
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<ActFailure | null>(null);
  const { id, sessionId, toolCallId, subject } = item;

  const send = useCallback(
    function attempt(approved: boolean) {
      if (sending) return;
      setSending(true);
      setFailure(null);
      approveWorkbenchCall(sessionId, toolCallId, approved).then(
        () => {
          setSending(false);
          toast.success(`${approved ? "Approved" : "Rejected"} ${subject}.`);
          markActed(id);
          reload();
        },
        (cause: unknown) => {
          setSending(false);
          setFailure(
            reportActFailure(approved ? "Approving" : "Rejecting", subject, cause, () =>
              attempt(approved),
            ),
          );
        },
      );
    },
    [sending, sessionId, toolCallId, subject, id, markActed, reload],
  );

  const approve = useCallback(() => send(true), [send]);
  const reject = useCallback(() => send(false), [send]);

  return {
    need: reads.session?.status === "ready" ? null : SESSION_NEED,
    sending,
    failure,
    approve,
    reject,
  };
}
