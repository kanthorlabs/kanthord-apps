import { useCallback, useState } from "react";

import { createWorkbenchSession, sendWorkbenchMessage } from "@/api/resources/workbench";
import type { WorkbenchConfiguration } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";
import type { ChatActionFailure } from "./use-chat-actions";
import type { FirstSendFailure } from "@/lib/workbench-new-session";

export interface FirstSendState {
  readonly failure: ChatActionFailure | null;
  readonly busy: boolean;
  readonly send: (text: string) => Promise<boolean>;
}

export type OpenCreatedSession = (sessionId: string, failure: FirstSendFailure | null) => void;

export function useFirstSend(
  agentName: string,
  configuration: WorkbenchConfiguration | null,
  open: OpenCreatedSession,
): FirstSendState {
  const [failure, setFailure] = useState<ChatActionFailure | null>(null);
  const [busy, setBusy] = useState(false);

  const send = useCallback(
    async (text: string): Promise<boolean> => {
      if (configuration === null) return false;
      setFailure(null);
      setBusy(true);
      let sessionId: string;
      try {
        sessionId = (await createWorkbenchSession({ agent_name: agentName, ...configuration })).id;
      } catch (cause) {
        const error = asApiError(cause);
        setFailure({ cause: "send", code: error.code, message: error.message });
        setBusy(false);
        return false;
      }
      try {
        await sendWorkbenchMessage(sessionId, text);
      } catch (cause) {
        const error = asApiError(cause);
        open(sessionId, { draft: text, code: error.code, message: error.message });
        return false;
      }
      open(sessionId, null);
      return true;
    },
    [agentName, configuration, open],
  );

  return { failure, busy, send };
}
