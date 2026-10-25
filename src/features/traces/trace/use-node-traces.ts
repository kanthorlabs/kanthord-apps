import { useMemo } from "react";

import type { ApiError } from "@/api/errors";
import { listNodeAttempts } from "@/api/resources/mission";
import { listTracePage, listTraceSpans } from "@/api/resources/tracking";
import type {
  EffectiveCause,
  MissionAttempt,
  TraceListItem,
  TraceSpan,
  TraceState,
  TraceSummary,
} from "@/api/types";
import { useResource } from "@/hooks/use-resource";
import { promptChanged } from "@/lib/agent-prompt-parts";
import { durationText } from "@/lib/format";
import {
  attemptGroups,
  repeatAdvice,
  type AttemptExecution,
  type ExecutionKind,
} from "@/lib/trace-attempts";
import { causeLine, isRepeat } from "@/lib/trace-cause";

export const NODE_TRACE_LIMIT = 100;

const NO_ITEMS: readonly TraceListItem[] = [];
const NO_ATTEMPTS: readonly MissionAttempt[] = [];

const KIND_LABELS: Readonly<Record<ExecutionKind, string>> = {
  steps: "Steps",
  evaluation: "Evaluation",
};
const UNKNOWN_KIND_LABEL = "Execution";
const STATE_LABELS: Readonly<Record<TraceState, string>> = {
  open: "Open",
  ok: "OK",
  error: "Error",
};
const RUNNING_TEXT = "running";

export interface NodeExecution {
  readonly traceId: string;
  readonly kindLabel: string;
  readonly stateLabel: string;
  readonly causeText: string | null;
  readonly durationLabel: string;
  readonly isRepeat: boolean;
  readonly advice: string | null;
  readonly current: boolean;
  readonly promptChanged: boolean;
  readonly path: string;
}

export interface NodeAttempt {
  readonly attempt: number;
  readonly nodeRevision: number | null;
  readonly planChanged: boolean;
  readonly executions: readonly NodeExecution[];
}

export interface NodeTraces {
  readonly items: readonly TraceListItem[];
  readonly groups: readonly NodeAttempt[];
  readonly repeatedAttempts: number;
  readonly repeatedExecutions: number;
  readonly loading: boolean;
  readonly error: ApiError | null;
  readonly retry: () => void;
}

interface NodeRead {
  readonly items: readonly TraceListItem[];
  readonly attempts: readonly MissionAttempt[];
}

interface SpanRead {
  readonly previous: readonly TraceSpan[];
  readonly current: readonly TraceSpan[];
}

async function readNode(nodeId: string | null): Promise<NodeRead> {
  if (nodeId === null) return { items: NO_ITEMS, attempts: NO_ATTEMPTS };
  const [page, attempts] = await Promise.all([
    listTracePage({ node_id: nodeId }, null, NODE_TRACE_LIMIT),
    listNodeAttempts(nodeId),
  ]);
  return { items: page.items, attempts };
}

async function readSpans(previousId: string | null, currentId: string): Promise<SpanRead | null> {
  if (previousId === null) return null;
  const [previous, current] = await Promise.all([
    listTraceSpans(previousId),
    listTraceSpans(currentId),
  ]);
  return { previous, current };
}

function previousTraceIdOf(items: readonly TraceListItem[], summary: TraceSummary): string | null {
  const earlier = items
    .filter((item) => item.trace_id !== summary.trace_id && item.created_at < summary.created_at)
    .sort((a, b) => b.created_at - a.created_at);
  return earlier[0]?.trace_id ?? null;
}

function markedRepeats(
  executions: readonly AttemptExecution[],
): readonly (AttemptExecution & { readonly isRepeat: boolean })[] {
  let previousFailed: EffectiveCause | null = null;
  return executions.map((execution) => {
    const repeated = isRepeat(previousFailed, execution.cause);
    if (execution.state === "error") previousFailed = execution.cause;
    return { ...execution, isRepeat: repeated };
  });
}

function executionOf(
  execution: AttemptExecution & { readonly isRepeat: boolean },
  currentId: string,
  changed: boolean,
): NodeExecution {
  const current = execution.traceId === currentId;
  const advice = execution.cause === null ? null : repeatAdvice(execution.cause);
  return {
    traceId: execution.traceId,
    kindLabel: execution.kind === null ? UNKNOWN_KIND_LABEL : KIND_LABELS[execution.kind],
    stateLabel: STATE_LABELS[execution.state],
    causeText: execution.cause === null ? null : causeLine(execution.cause),
    durationLabel:
      execution.duration_ms === null ? RUNNING_TEXT : durationText(execution.duration_ms),
    isRepeat: execution.isRepeat,
    advice: execution.isRepeat ? advice : null,
    current,
    promptChanged: current && changed,
    path: `/traces/${encodeURIComponent(execution.traceId)}?tab=summary`,
  };
}

function groupsOf(
  items: readonly TraceListItem[],
  attempts: readonly MissionAttempt[],
  currentId: string,
  changed: boolean,
): readonly NodeAttempt[] {
  return attemptGroups(items, attempts).map((group) => ({
    attempt: group.attempt,
    nodeRevision: group.nodeRevision,
    planChanged: group.planChanged,
    executions: markedRepeats(group.executions).map((execution) =>
      executionOf(execution, currentId, changed),
    ),
  }));
}

export function useNodeTraces(summary: TraceSummary): NodeTraces {
  const { node_id: nodeId, trace_id: traceId } = summary;
  const node = useResource(() => readNode(nodeId), [nodeId]);
  const items = node.data?.items ?? NO_ITEMS;
  const previousId = previousTraceIdOf(items, summary);
  const spans = useResource(() => readSpans(previousId, traceId), [previousId, traceId]);
  const changed = spans.data !== null && promptChanged(spans.data.previous, spans.data.current);
  const attempts = node.data?.attempts ?? NO_ATTEMPTS;

  const groups = useMemo(
    () => groupsOf(items, attempts, traceId, changed),
    [items, attempts, traceId, changed],
  );
  const repeated = groups.map((group) =>
    group.executions.filter((execution) => execution.isRepeat),
  );

  return {
    items,
    groups,
    repeatedAttempts: repeated.filter((executions) => executions.length > 0).length,
    repeatedExecutions: repeated.reduce((total, executions) => total + executions.length, 0),
    loading: node.loading,
    error: node.error ?? spans.error,
    retry: () => {
      node.reload();
      spans.reload();
    },
  };
}
