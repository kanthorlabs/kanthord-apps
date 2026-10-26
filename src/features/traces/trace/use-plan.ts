import type { ApiError } from "@/api/errors";
import type { MissionRevision, TraceSpan } from "@/api/types";

import type { TraceNode } from "./use-trace-node";

export type TaskState = "done" | "failed" | "open";

export interface PlanTask {
  readonly id: string;
  readonly name: string;
  readonly state: TaskState;
}

export interface Plan {
  readonly name: string;
  readonly revision: number;
  readonly requirement: string;
  readonly criterion: string;
  readonly verifications: readonly string[];
  readonly tasks: readonly PlanTask[];
}

export interface PlanView {
  readonly plan: Plan | null;
  readonly error: ApiError | null;
}

const OPERATION_TASK = "worker.task";
const ATTRIBUTE_TASK_ID = "kanthord.task.id";
const ATTRIBUTE_TASK_RESULT = "kanthord.task.result";
const RESULT_COMPLETE = "complete";

function stateOf(taskId: string, spans: readonly TraceSpan[]): TaskState {
  const taskSpans = spans.filter(
    (span) => span.operation === OPERATION_TASK && span.attributes[ATTRIBUTE_TASK_ID] === taskId,
  );
  if (taskSpans.some((span) => span.attributes[ATTRIBUTE_TASK_RESULT] === RESULT_COMPLETE)) {
    return "done";
  }
  return taskSpans.some((span) => span.status === "Error") ? "failed" : "open";
}

function planOf(revision: MissionRevision, spans: readonly TraceSpan[]): Plan {
  const { content } = revision;
  return {
    name: content.name,
    revision: revision.revision,
    requirement: content.requirement,
    criterion: content.criterion,
    verifications: content.verifications,
    tasks: revision.tasks.map((task) => ({
      id: task.id,
      name: task.content.name,
      state: stateOf(task.id, spans),
    })),
  };
}

export function usePlan(traceNode: TraceNode, spans: readonly TraceSpan[]): PlanView {
  const { revision, revisionError: error } = traceNode;
  return { plan: revision === null ? null : planOf(revision, spans), error };
}
