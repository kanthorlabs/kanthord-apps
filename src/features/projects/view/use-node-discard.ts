import { useCallback, useState } from "react";
import { toast } from "sonner";

import { discardNode } from "@/api/resources/mission";
import type { MissionRunnableNode, NodeState } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";

export interface NodeDiscardState {
  readonly available: boolean;
  readonly open: boolean;
  readonly reason: string;
  readonly missing: string | null;
  readonly error: string | null;
  readonly discarding: boolean;
  readonly consequence: string;
  readonly saferPath: string;
  readonly request: () => void;
  readonly setReason: (reason: string) => void;
  readonly cancel: () => void;
  readonly confirm: () => void;
}

const DISCARD_STATES: readonly NodeState[] = [
  "Pending",
  "Available",
  "Executing",
  "Waiting",
  "Evaluating",
  "Blocked",
  "Paused",
  "External.Success",
  "External.Failed",
];

const CONFLICT_MESSAGES: Readonly<Record<string, string>> = {
  "mission.node.state_conflict":
    "The state or the attempt of the node changed after this read. The sheet now shows its current state. Review it and discard again.",
  "mission.node.control_refused":
    "The node is in a state that admits no discard. The sheet now shows its current state.",
  "mission.node.action_unresolved":
    "The open attempt has a requested external action without its end state. Wait for the action to end, then discard.",
  "mission.version.conflict":
    "The mission changed after this read. The sheet now shows the current mission. Review the node and discard again.",
  "mission.node.retired": "The node is retired. The sheet now shows its current state.",
  "mission.node.terminal": "The node is terminal. The sheet now shows its current state.",
};

function isDiscardable(node: MissionRunnableNode): boolean {
  return node.retired_at === null && DISCARD_STATES.includes(node.state);
}

function consequenceOf(node: MissionRunnableNode): string {
  const outcome = "writes an undetermined outcome with the reason and ends the node as Discarded";
  const close =
    node.attempt === 0
      ? `No attempt of ${node.content.name} is open. Discard ${outcome}.`
      : node.state === "Blocked"
        ? `Attempt ${node.attempt} of ${node.content.name} is closed. Discard ${outcome}.`
        : `Discard closes attempt ${node.attempt} of ${node.content.name}, ${outcome}.`;
  return `${close} A discarded node satisfies no dependency, so a node that depends on ${node.content.name} cannot start. A discard cannot be undone.`;
}

function saferPathOf(node: MissionRunnableNode): string {
  if (node.state === "Blocked") {
    return `To run ${node.content.name} again instead, keep it and unblock it.`;
  }
  return `To keep ${node.content.name}, cancel. The node stays ${node.state}.`;
}

export function useNodeDiscard(
  node: MissionRunnableNode,
  missionVersion: number,
  reload: () => void,
): NodeDiscardState {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const available = isDiscardable(node);
  const trimmed = reason.trim();

  const request = useCallback(() => {
    if (!isDiscardable(node)) return;
    setError(null);
    setReason("");
    setOpen(true);
  }, [node]);

  const cancel = useCallback(() => {
    if (discarding) return;
    setOpen(false);
    setError(null);
  }, [discarding]);

  const confirm = useCallback(() => {
    if (discarding || !open || trimmed.length === 0) return;
    if (!isDiscardable(node)) {
      setOpen(false);
      return;
    }
    setDiscarding(true);
    setError(null);
    discardNode(node.id, {
      reason: trimmed,
      expected_mission_version: missionVersion,
      expected_state: node.state,
      expected_attempt: node.attempt,
    }).then(
      () => {
        setDiscarding(false);
        toast.success(`Discarded ${node.content.name}.`, {
          description:
            "The node is Discarded with an undetermined outcome. It satisfies no dependency.",
        });
        setOpen(false);
        reload();
      },
      (cause: unknown) => {
        setDiscarding(false);
        const failure = asApiError(cause);
        setError(CONFLICT_MESSAGES[failure.detail] ?? failure.message);
        reload();
      },
    );
  }, [discarding, open, trimmed, node, missionVersion, reload]);

  return {
    available,
    open,
    reason,
    missing: trimmed.length === 0 ? "Fill Reason to discard." : null,
    error,
    discarding,
    consequence: consequenceOf(node),
    saferPath: saferPathOf(node),
    request,
    setReason,
    cancel,
    confirm,
  };
}
