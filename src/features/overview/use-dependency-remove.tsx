import { type ReactNode, useCallback, useState } from "react";
import { toast } from "sonner";

import { removeDependency } from "@/api/resources/mission";
import type { MissionNodeRecord } from "@/api/types";
import { RecordName } from "@/components/record-name";
import { asApiError } from "@/hooks/use-resource";
import type { DiscardedDependency } from "@/lib/attention";
import { isTerminal } from "@/lib/node-state";

export interface DependencyRemoveState {
  readonly target: DiscardedDependency | null;
  readonly available: boolean;
  readonly reason: string;
  readonly missing: string | null;
  readonly error: string | null;
  readonly removing: boolean;
  readonly consequence: ReactNode;
  readonly saferPath: ReactNode;
  readonly request: (dependency: DiscardedDependency) => void;
  readonly setReason: (reason: string) => void;
  readonly cancel: () => void;
  readonly confirm: () => void;
}

const CONFLICT_MESSAGES: Readonly<Record<string, string>> = {
  "mission.version.conflict":
    "The mission changed after this read. The view now shows the current mission. Review the node and remove the dependency again.",
  "mission.node.retired": "The node is retired. The view now shows its current state.",
  "mission.node.terminal": "The node is terminal. The view now shows its current state.",
};

function isRemovable(node: MissionNodeRecord): boolean {
  return node.retired_at === null && !isTerminal(node.state);
}

export function useDependencyRemove(
  node: MissionNodeRecord,
  missionVersion: number,
  reload: () => void,
): DependencyRemoveState {
  const [target, setTarget] = useState<DiscardedDependency | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const available = isRemovable(node);
  const trimmed = reason.trim();

  const request = useCallback(
    (dependency: DiscardedDependency) => {
      if (!isRemovable(node)) return;
      setError(null);
      setReason("");
      setTarget(dependency);
    },
    [node],
  );

  const cancel = useCallback(() => {
    if (removing) return;
    setTarget(null);
    setError(null);
  }, [removing]);

  const confirm = useCallback(() => {
    if (removing || target === null || trimmed.length === 0) return;
    if (!isRemovable(node)) {
      setTarget(null);
      return;
    }
    setRemoving(true);
    setError(null);
    removeDependency(node.id, target.id, {
      reason: trimmed,
      expected_mission_version: missionVersion,
    }).then(
      () => {
        setRemoving(false);
        toast.success(`Removed the dependency of ${node.content.name} on ${target.name}.`, {
          description:
            "The mission version changed. The node can start when its other dependencies are Completed.",
        });
        setTarget(null);
        reload();
      },
      (cause: unknown) => {
        setRemoving(false);
        const failure = asApiError(cause);
        const message = CONFLICT_MESSAGES[failure.detail] ?? failure.message;
        setError(message);
        toast.error(`Removing the dependency of ${node.content.name} on ${target.name} failed.`, {
          description: message,
        });
        reload();
      },
    );
  }, [removing, target, trimmed, node, missionVersion, reload]);

  const name = <RecordName>{node.content.name}</RecordName>;
  return {
    target,
    available,
    reason,
    missing: trimmed.length === 0 ? "Fill Reason to remove the dependency." : null,
    error,
    removing,
    consequence: (
      <>
        Remove dependency deletes the edge from {name} to{" "}
        <RecordName>{target?.name ?? ""}</RecordName>. {name} can start when its other dependencies
        are Completed. The edit changes the mission version.
      </>
    ),
    saferPath: <>To end {name} instead, discard it.</>,
    request,
    setReason,
    cancel,
    confirm,
  };
}
