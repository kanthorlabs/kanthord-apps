import { useCallback, useState } from "react";
import { toast } from "sonner";

import {
  disableAgentEnablement,
  enableAgentEnablement,
  readAgentEnablement,
} from "@/api/resources/workers";
import type { AgentEnablementState } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";

export interface EnablementSubject {
  readonly agentName: string;
  readonly state: AgentEnablementState;
}

export interface EnablementSwitchState {
  readonly label: "Enable" | "Disable";
  readonly failure: string | null;
  readonly pending: boolean;
  readonly confirming: boolean;
  readonly run: () => void;
  readonly cancel: () => void;
  readonly confirm: () => void;
}

export function useEnablementSwitch(
  subject: EnablementSubject,
  reload: () => void,
): EnablementSwitchState {
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [revision, setRevision] = useState<number | null>(null);
  const { agentName, state } = subject;
  const enabled = state === "enabled";

  const write = useCallback(
    (expectedRevision: number) => {
      const change = enabled ? disableAgentEnablement : enableAgentEnablement;
      setPending(true);
      change(agentName, expectedRevision).then(
        (answer) => {
          setPending(false);
          setConfirming(false);
          toast.success(`${answer.agent_name} is ${answer.state} at revision ${answer.revision}.`);
          reload();
        },
        (cause: unknown) => {
          setPending(false);
          setConfirming(false);
          setFailure(asApiError(cause).message);
        },
      );
    },
    [enabled, agentName, reload],
  );

  const run = useCallback(() => {
    if (pending) return;
    setFailure(null);
    setPending(true);
    readAgentEnablement(agentName).then(
      (fresh) => {
        if (fresh.state !== state) {
          setPending(false);
          toast.info(`${agentName} did not change.`, {
            description: `${agentName} is already ${fresh.state}. The view now shows its current state.`,
          });
          reload();
          return;
        }
        if (!enabled) {
          write(fresh.revision);
          return;
        }
        setPending(false);
        setRevision(fresh.revision);
        setConfirming(true);
      },
      (cause: unknown) => {
        setPending(false);
        setFailure(asApiError(cause).message);
      },
    );
  }, [pending, agentName, state, enabled, reload, write]);

  const cancel = useCallback(() => {
    if (!pending) setConfirming(false);
  }, [pending]);

  const confirm = useCallback(() => {
    if (pending || !confirming || revision === null) return;
    write(revision);
  }, [pending, confirming, revision, write]);

  return {
    label: enabled ? "Disable" : "Enable",
    failure,
    pending,
    confirming,
    run,
    cancel,
    confirm,
  };
}
