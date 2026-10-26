import { useMemo } from "react";

import type { ApiError } from "@/api/errors";
import { listNodeAttempts, readNodeRevision } from "@/api/resources/mission";
import { listTracePage } from "@/api/resources/tracking";
import type { MissionAttempt, MissionRevision, TraceListItem, TraceSummary } from "@/api/types";
import { useResource } from "@/hooks/use-resource";

export const NODE_TRACE_LIMIT = 100;

const NO_ITEMS: readonly TraceListItem[] = [];
const NO_ATTEMPTS: readonly MissionAttempt[] = [];
const NO_TASK_NAMES: ReadonlyMap<string, string> = new Map();

export interface TraceNode {
  readonly items: readonly TraceListItem[];
  readonly attempts: readonly MissionAttempt[];
  readonly revision: MissionRevision | null;
  readonly revisionError: ApiError | null;
  readonly taskNames: ReadonlyMap<string, string>;
  readonly loading: boolean;
  readonly error: ApiError | null;
  readonly retry: () => void;
}

async function readItems(nodeId: string | null): Promise<readonly TraceListItem[]> {
  if (nodeId === null) return NO_ITEMS;
  return (await listTracePage({ node_id: nodeId }, null, NODE_TRACE_LIMIT)).items;
}

async function readAttempts(nodeId: string | null): Promise<readonly MissionAttempt[]> {
  if (nodeId === null) return NO_ATTEMPTS;
  return listNodeAttempts(nodeId);
}

async function readRevision(
  nodeId: string | null,
  revision: number | null,
): Promise<MissionRevision | null> {
  if (nodeId === null || revision === null) return null;
  return readNodeRevision(nodeId, revision);
}

function taskNamesOf(revision: MissionRevision | null): ReadonlyMap<string, string> {
  if (revision === null) return NO_TASK_NAMES;
  if (revision.tasks.length === 0) {
    return new Map([[revision.node_id, revision.content.name]]);
  }
  return new Map(revision.tasks.map((task) => [task.id, task.content.name]));
}

export function useTraceNode(summary: TraceSummary | null): TraceNode {
  const nodeId = summary?.node_id ?? null;
  const attempt = summary?.attempt ?? null;
  const items = useResource(() => readItems(nodeId), [nodeId]);
  const attempts = useResource(() => readAttempts(nodeId), [nodeId]);
  const revisionNumber =
    attempts.data?.find((candidate) => candidate.attempt === attempt)?.node_revision ?? null;
  const revision = useResource(
    () => readRevision(nodeId, revisionNumber),
    [nodeId, revisionNumber],
  );
  const taskNames = useMemo(() => taskNamesOf(revision.data), [revision.data]);

  return {
    items: items.data ?? NO_ITEMS,
    attempts: attempts.data ?? NO_ATTEMPTS,
    revision: revision.data,
    revisionError: attempts.error ?? revision.error,
    taskNames,
    loading: items.loading || attempts.loading,
    error: items.error ?? attempts.error,
    retry: () => {
      items.reload();
      attempts.reload();
      revision.reload();
    },
  };
}
