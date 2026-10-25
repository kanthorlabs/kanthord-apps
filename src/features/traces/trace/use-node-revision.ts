import { useMemo } from "react";

import type { ApiError } from "@/api/errors";
import { listNodeAttempts, readNodeRevision } from "@/api/resources/mission";
import type { MissionRevision, TraceSummary } from "@/api/types";
import { useResource } from "@/hooks/use-resource";

export interface NodeRevisionView {
  readonly revision: MissionRevision | null;
  readonly error: ApiError | null;
  readonly taskNames: ReadonlyMap<string, string>;
}

const NO_TASK_NAMES: ReadonlyMap<string, string> = new Map();

async function readTraceRevision(
  nodeId: string | null,
  attempt: number | null,
): Promise<MissionRevision | null> {
  if (nodeId === null || attempt === null) return null;
  const attempts = await listNodeAttempts(nodeId);
  const traced = attempts.find((candidate) => candidate.attempt === attempt);
  if (traced === undefined) return null;
  return readNodeRevision(nodeId, traced.node_revision);
}

function taskNamesOf(revision: MissionRevision | null): ReadonlyMap<string, string> {
  if (revision === null) return NO_TASK_NAMES;
  return new Map(revision.tasks.map((task) => [task.id, task.content.name]));
}

export function useNodeRevision(summary: TraceSummary): NodeRevisionView {
  const { node_id: nodeId, attempt } = summary;
  const resource = useResource(() => readTraceRevision(nodeId, attempt), [nodeId, attempt]);
  const taskNames = useMemo(() => taskNamesOf(resource.data), [resource.data]);
  return { revision: resource.data, error: resource.error, taskNames };
}
