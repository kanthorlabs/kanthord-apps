import { useMemo } from "react";

import type { ApiError } from "@/api/errors";
import { readTraceText } from "@/api/resources/tracking";
import type { EffectiveCause, TraceSpan, TraceSummary } from "@/api/types";
import { useResource } from "@/hooks/use-resource";
import { diagnoseSpans, type SpanDiagnosis } from "@/lib/trace-diagnosis";
import { causeLabelReasonTextIdOf } from "@/lib/trace-cause";
import { type NowFacts, nowFactsOf } from "@/lib/trace-now";

import type { NodeAttempt, NodeTraces } from "./use-node-traces";
import { TRACE_POLL_MS } from "./use-trace";

export interface ReworkCause {
  readonly cause: EffectiveCause;
  readonly traceId: string;
  readonly path: string;
}

export interface Diagnosis extends SpanDiagnosis {
  readonly reason: string | null;
  readonly reasonError: ApiError | null;
  readonly rework: ReworkCause | null;
  readonly now: NowFacts | null;
}

function reworkOf(
  traceId: string,
  cause: EffectiveCause | null,
  groups: readonly NodeAttempt[],
): ReworkCause | null {
  if (cause !== null) return null;
  const group = groups.find((entry) =>
    entry.executions.some((execution) => execution.traceId === traceId),
  );
  const executions = group?.executions ?? [];
  const index = executions.findIndex((execution) => execution.traceId === traceId);
  if (executions[index]?.kind !== "steps") return null;
  const evaluation = executions
    .slice(index + 1)
    .find((execution) => execution.kind === "evaluation");
  if (evaluation === undefined || evaluation.cause === null) return null;
  return { cause: evaluation.cause, traceId: evaluation.traceId, path: evaluation.path };
}

export function useDiagnosis(
  summary: TraceSummary,
  spans: readonly TraceSpan[],
  nodeTraces: NodeTraces,
  now: number,
  taskNames: ReadonlyMap<string, string>,
): Diagnosis {
  const { trace_id: traceId, root_span_id: rootSpanId, state } = summary;
  const diagnosis = useMemo(
    () => diagnoseSpans(spans, rootSpanId, taskNames),
    [spans, rootSpanId, taskNames],
  );
  const reason = useResource(
    async () =>
      diagnosis.labeledBy === null
        ? null
        : (await readTraceText(traceId, causeLabelReasonTextIdOf(rootSpanId))).content,
    [traceId, rootSpanId, diagnosis.labeledAt],
  );

  return {
    ...diagnosis,
    reason: reason.data,
    reasonError: reason.error,
    rework: reworkOf(traceId, diagnosis.cause, nodeTraces.groups),
    now: state === "open" ? nowFactsOf(spans, now, TRACE_POLL_MS) : null,
  };
}
