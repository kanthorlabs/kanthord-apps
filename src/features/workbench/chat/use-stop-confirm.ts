import { useCallback, useState } from "react";

import type { StopConfirmProps } from "./components/stop-confirm";
import { parseSlashCommand } from "./slash-commands";
import type { ChatActionsState } from "./use-chat-actions";
import type { ComposerState } from "./use-composer";

interface StopConfirmInput {
  readonly runActive: boolean;
  readonly queueCount: number;
  readonly actions: Pick<ChatActionsState, "abort" | "busy">;
  readonly composer: Pick<ComposerState, "draft" | "submit">;
}

export interface StopConfirmState {
  readonly stop: () => void;
  readonly confirm: StopConfirmProps | null;
}

export function useStopConfirm({
  runActive,
  queueCount,
  actions,
  composer,
}: StopConfirmInput): StopConfirmState {
  const [confirming, setConfirming] = useState(false);
  if (confirming && (!runActive || queueCount === 0)) setConfirming(false);
  const { abort, busy } = actions;
  const { draft, submit } = composer;

  const stop = useCallback(() => {
    if (queueCount === 0) {
      abort();
      return;
    }
    setConfirming(true);
  }, [queueCount, abort]);

  const hasDraft = draft.trim() !== "" && parseSlashCommand(draft)?.command !== "new";

  if (!confirming) return { stop, confirm: null };
  return {
    stop,
    confirm: {
      count: queueCount,
      hasDraft,
      busy,
      onStop: () => {
        setConfirming(false);
        abort();
      },
      onStopAndSend: () => {
        setConfirming(false);
        submit("replace");
      },
      onCancel: () => setConfirming(false),
    },
  };
}
