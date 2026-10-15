import { useCallback, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { overrideNode } from "@/api/resources/mission";
import type { MissionExternalAction, MissionRunnableNode, NodeState } from "@/api/types";
import { RecordName } from "@/components/record-name";
import { asApiError } from "@/hooks/use-resource";
import { unresolvedRequestsOf } from "@/lib/external-requests";

export interface NodeOverrideState {
  readonly available: boolean;
  readonly open: boolean;
  readonly reason: string;
  readonly missing: string | null;
  readonly error: string | null;
  readonly overriding: boolean;
  readonly consequence: ReactNode;
  readonly saferPath: ReactNode;
  readonly request: () => void;
  readonly setReason: (reason: string) => void;
  readonly cancel: () => void;
  readonly confirm: () => void;
}

const OVERRIDE_STATES: readonly NodeState[] = [
  "Pending",
  "Available",
  "Executing",
  "Waiting",
  "Blocked",
  "Paused",
  "External.Success",
  "External.Failed",
];

const CONFLICT_MESSAGES: Readonly<Record<string, string>> = {
  "mission.node.state_conflict":
    "The state or the attempt of the node changed after this read. The view now shows its current state. Review it and override again.",
  "mission.node.control_refused":
    "The node is in a state that admits no override. The view now shows its current state.",
  "mission.node.action_unresolved":
    "The open attempt has a requested external action without its end state. Wait for the action to end, then override.",
  "mission.version.conflict":
    "The mission changed after this read. The view now shows the current mission. Review the node and override again.",
  "mission.node.retired": "The node is retired. The view now shows its current state.",
  "mission.node.terminal": "The node is terminal. The view now shows its current state.",
};

function isOverridable(
  node: MissionRunnableNode,
  actions: readonly MissionExternalAction[] | null,
): boolean {
  if (node.retired_at !== null || !OVERRIDE_STATES.includes(node.state)) return false;
  if (node.state !== "Paused") return true;
  return actions !== null && unresolvedRequestsOf(actions).length === 0;
}

function saferPathOf(node: MissionRunnableNode): ReactNode {
  if (node.state === "Blocked") return <>To run it again, unblock it.</>;
  if (node.state === "Paused") return <>To continue the work, resume it.</>;
  return (
    <>
      To keep <RecordName>{node.content.name}</RecordName>, cancel. The node stays {node.state}.
    </>
  );
}

export function useNodeOverride(
  node: MissionRunnableNode,
  missionVersion: number,
  actions: readonly MissionExternalAction[] | null,
  reload: () => void,
): NodeOverrideState {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [overriding, setOverriding] = useState(false);
  const available = isOverridable(node, actions);
  const trimmed = reason.trim();

  const request = useCallback(() => {
    if (!isOverridable(node, actions)) return;
    setError(null);
    setReason("");
    setOpen(true);
  }, [node, actions]);

  const cancel = useCallback(() => {
    if (overriding) return;
    setOpen(false);
    setError(null);
  }, [overriding]);

  const confirm = useCallback(() => {
    if (overriding || !open || trimmed.length === 0) return;
    if (!isOverridable(node, actions)) {
      setOpen(false);
      return;
    }
    setOverriding(true);
    setError(null);
    overrideNode(node.id, {
      reason: trimmed,
      expected_mission_version: missionVersion,
      expected_state: node.state,
      expected_attempt: node.attempt,
      result: "success",
    }).then(
      () => {
        setOverriding(false);
        toast.success(`Overrode ${node.content.name}.`, {
          description: "The node is Completed with a success outcome on your authority.",
        });
        setOpen(false);
        reload();
      },
      (cause: unknown) => {
        setOverriding(false);
        const failure = asApiError(cause);
        setError(CONFLICT_MESSAGES[failure.detail] ?? failure.message);
        reload();
      },
    );
  }, [overriding, open, trimmed, node, actions, missionVersion, reload]);

  return {
    available,
    open,
    reason,
    missing: trimmed.length === 0 ? "Fill Reason to override." : null,
    error,
    overriding,
    consequence: (
      <>
        Override records a success outcome for <RecordName>{node.content.name}</RecordName> on your
        authority and ends it as Completed. Nodes that depend on it can start. No commit is
        recorded. An override cannot be undone.
      </>
    ),
    saferPath: saferPathOf(node),
    request,
    setReason,
    cancel,
    confirm,
  };
}
