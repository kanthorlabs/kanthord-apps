import { useCallback, useState } from "react";

import { createWorkbenchSession, sendWorkbenchMessage } from "@/api/resources/workbench";
import type { WorkbenchConfiguration } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";
import type { ChatActionFailure } from "./use-chat-actions";
import { engineCodeOf } from "@/lib/agent-variant";
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
  variantId: string | null = null,
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
        const body = {
          agent_name: agentName,
          ...(variantId === null ? {} : { variant_id: variantId }),
          ...configuration,
        };
        sessionId = (await createWorkbenchSession(body)).id;
      } catch (cause) {
        const error = asApiError(cause);
        setFailure({ cause: "send", code: engineCodeOf(error), message: error.message });
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
    [agentName, configuration, open, variantId],
  );

  return { failure, busy, send };
}
