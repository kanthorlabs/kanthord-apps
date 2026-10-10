import { useCallback, useState, type ReactNode } from "react";

import type { ApiError } from "@/api/errors";
import { exportMissionJson, readMission } from "@/api/resources/mission";
import type { BindingSetEntry, MissionPlanEntry } from "@/api/types";
import { RecordName } from "@/components/record-name";
import { asApiError } from "@/hooks/use-resource";
import { isAvailable, nodesNaming, type BindingChangeKind } from "@/lib/binding-change";

export interface BindingChange {
  readonly name: string;
  readonly before: BindingSetEntry | undefined;
  readonly after: BindingSetEntry | null;
  readonly kind: BindingChangeKind;
}

export interface BindingChangeGuardState {
  readonly change: BindingChange | null;
  readonly consequence: ReactNode;
  readonly confirmLabel: string;
  readonly saferLabel: string | null;
  readonly nodes: readonly MissionPlanEntry[] | null;
  readonly nodesError: ApiError | null;
  readonly open: (change: BindingChange) => void;
  readonly close: () => void;
}

function consequenceOf(change: BindingChange): ReactNode {
  const refusal = "refuses every use of it, including records that pin an earlier revision";
  const name = <RecordName>{change.name}</RecordName>;
  if (change.kind === "remove") {
    return (
      <>
        Removing {name} {refusal}.
      </>
    );
  }
  if (change.kind === "disable") {
    return (
      <>
        Making {name} unavailable {refusal}, until it is available again.
      </>
    );
  }
  return (
    <>
      This change names another resource, so it removes {name} and adds a new binding. The old
      binding {refusal}.
    </>
  );
}

function confirmLabelOf(kind: BindingChangeKind): string {
  if (kind === "remove") return "Remove binding";
  if (kind === "disable") return "Make unavailable";
  return "Replace binding";
}

function saferLabelOf(change: BindingChange): string | null {
  if (change.kind === "remove") {
    return change.before !== undefined && isAvailable(change.before)
      ? "Make unavailable instead"
      : null;
  }
  return change.kind === "disable" ? "Keep available" : "Keep the current resource";
}

export function useBindingChangeGuard(projectId: string): BindingChangeGuardState {
  const [change, setChange] = useState<BindingChange | null>(null);
  const [nodes, setNodes] = useState<readonly MissionPlanEntry[] | null>(null);
  const [nodesError, setNodesError] = useState<ApiError | null>(null);

  const open = useCallback(
    (next: BindingChange) => {
      setChange(next);
      setNodes(null);
      setNodesError(null);
      readMission(projectId)
        .then((mission) => exportMissionJson(mission.id))
        .then(
          (plan) => setNodes(nodesNaming(plan.entries, next.name)),
          (cause: unknown) => setNodesError(asApiError(cause)),
        );
    },
    [projectId],
  );

  const close = useCallback(() => setChange(null), []);

  return {
    change,
    consequence: change === null ? null : consequenceOf(change),
    confirmLabel: change === null ? "" : confirmLabelOf(change.kind),
    saferLabel: change === null ? null : saferLabelOf(change),
    nodes,
    nodesError,
    open,
    close,
  };
}
