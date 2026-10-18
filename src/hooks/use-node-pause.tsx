import { useCallback, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { pauseNode } from "@/api/resources/mission";
import type { MissionNodeRecord, NodeState } from "@/api/types";
import { RecordName } from "@/components/record-name";
import { asApiError } from "@/hooks/use-resource";

export interface NodePauseState {
  readonly available: boolean;
  readonly open: boolean;
  readonly reason: string;
  readonly missing: string | null;
  readonly error: string | null;
  readonly pausing: boolean;
  readonly consequence: ReactNode;
  readonly saferPath: ReactNode;
  readonly request: () => void;
  readonly setReason: (reason: string) => void;
  readonly cancel: () => void;
  readonly confirm: () => void;
}

const PAUSE_STATES: readonly NodeState[] = [
  "Pending",
  "Available",
  "Executing",
  "Waiting",
  "Evaluating",
  "External.Requested",
  "External.Success",
  "External.Failed",
];

const LIVE_STATES: readonly NodeState[] = ["Executing", "Evaluating"];

const CONFLICT_MESSAGES: Readonly<Record<string, string>> = {
  "mission.node.state_conflict":
    "The state or the attempt of the node changed after this read. The view now shows its current state. Review it and pause again.",
  "mission.node.control_refused":
    "The node is in a state that admits no pause. The view now shows its current state.",
  "mission.version.conflict":
    "The mission changed after this read. The view now shows the current mission. Review the node and pause again.",
  "mission.node.retired": "The node is retired. The view now shows its current state.",
  "mission.node.terminal": "The node is terminal. The view now shows its current state.",
};

function isPausable(node: MissionNodeRecord): boolean {
  return node.retired_at === null && PAUSE_STATES.includes(node.state);
}

function consequenceOf(node: MissionNodeRecord): ReactNode {
  const name = <RecordName>{node.content.name}</RecordName>;
  if (LIVE_STATES.includes(node.state)) {
    return (
      <>
        Pause ends the live claim on {name} and holds the node as Paused. The worker stops its
        execution. The node runs no work until you resume it.
      </>
    );
  }
  return <>Pause holds {name} as Paused. The node runs no work until you resume it.</>;
}

function saferPathOf(node: MissionNodeRecord): ReactNode {
  return (
    <>
      To keep <RecordName>{node.content.name}</RecordName> as it is, cancel. The node stays{" "}
      {node.state}.
    </>
  );
}

export function useNodePause(
  node: MissionNodeRecord,
  missionVersion: number,
  reload: () => void,
): NodePauseState {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pausing, setPausing] = useState(false);
  const available = isPausable(node);
  const trimmed = reason.trim();

  const request = useCallback(() => {
    if (!isPausable(node)) return;
    setError(null);
    setReason("");
    setOpen(true);
  }, [node]);

  const cancel = useCallback(() => {
    if (pausing) return;
    setOpen(false);
    setError(null);
  }, [pausing]);

  const confirm = useCallback(() => {
    if (pausing || !open || trimmed.length === 0) return;
    if (!isPausable(node)) {
      setOpen(false);
      return;
    }
    setPausing(true);
    setError(null);
    pauseNode(node.id, {
      reason: trimmed,
      expected_mission_version: missionVersion,
      expected_state: node.state,
      expected_attempt: node.attempt,
    }).then(
      () => {
        setPausing(false);
        toast.success(`Paused ${node.content.name}.`, {
          description: "The node is Paused. Resume it to run the work again.",
        });
        setOpen(false);
        reload();
      },
      (cause: unknown) => {
        setPausing(false);
        const failure = asApiError(cause);
        const message = CONFLICT_MESSAGES[failure.detail] ?? failure.message;
        setError(message);
        toast.error(`Pausing ${node.content.name} failed.`, { description: message });
        reload();
      },
    );
  }, [pausing, open, trimmed, node, missionVersion, reload]);

  return {
    available,
    open,
    reason,
    missing: trimmed.length === 0 ? "Fill Reason to pause." : null,
    error,
    pausing,
    consequence: consequenceOf(node),
    saferPath: saferPathOf(node),
    request,
    setReason,
    cancel,
    confirm,
  };
}
