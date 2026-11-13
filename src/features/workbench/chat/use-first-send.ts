import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";

import { createWorkbenchSession, sendWorkbenchMessage } from "@/api/resources/workbench";
import type { WorkbenchConfiguration } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";
import type { ChatActionFailure } from "./use-chat-actions";
import { workbenchSessionPath } from "@/lib/workbench-sessions";

export interface FirstSendState {
  readonly failure: ChatActionFailure | null;
  readonly busy: boolean;
  readonly send: (text: string) => Promise<boolean>;
}

export function useFirstSend(
  agentName: string,
  configuration: WorkbenchConfiguration,
): FirstSendState {
  const navigate = useNavigate();
  const [failure, setFailure] = useState<ChatActionFailure | null>(null);
  const [busy, setBusy] = useState(false);

  const send = useCallback(
    async (text: string): Promise<boolean> => {
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
        navigate(workbenchSessionPath(sessionId), {
          replace: true,
          state: { firstSendFailure: { draft: text, code: error.code, message: error.message } },
        });
        return false;
      }
      navigate(workbenchSessionPath(sessionId), { replace: true });
      return true;
    },
    [agentName, configuration, navigate],
  );

  return { failure, busy, send };
}
