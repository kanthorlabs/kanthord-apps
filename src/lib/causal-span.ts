import type { TraceSpan } from "@/api/types";

const OPERATION_TURN = "agent.turn";
const OPERATION_VERIFICATION = "worker.verification";
const OPERATION_TASK = "worker.task";
const OPERATION_EVALUATION = "worker.evaluation";
const ATTRIBUTE_STOP_REASON = "kanthord.stop.reason";
const ATTRIBUTE_STOP_CODE = "kanthord.stop.code";
const ATTRIBUTE_ERROR_TYPE = "error.type";
const ATTRIBUTE_EXIT_CODE = "process.exit.code";
const ATTRIBUTE_EVALUATION_RESULT = "kanthord.evaluation.result";
const STOP_PROVIDER_FAILED = "provider_failed";
const STOP_ENVIRONMENT_FAILED = "environment_failed";
const STOP_NO_PROGRESS = "no_progress";
const STOP_CODE_COMMAND_ABSENT = "command_absent";
const EXIT_CODE_COMMAND_NOT_FOUND = 127;
const ERROR_TYPE_STOPPED = "stopped";
const RESULT_CRITERION_NOT_MET = "criterion-not-met";

export const ErrorRole = {
  Causal: "causal",
  Consequence: "consequence",
  Recovered: "recovered",
} as const;

export type ErrorRole = (typeof ErrorRole)[keyof typeof ErrorRole];

function isError(span: TraceSpan): boolean {
  return span.status === "Error";
}

function isStopped(span: TraceSpan): boolean {
  return span.attributes[ATTRIBUTE_ERROR_TYPE] === ERROR_TYPE_STOPPED;
}

function endOf(span: TraceSpan): number {
  return span.end_time ?? Number.NEGATIVE_INFINITY;
}

function startOf(span: TraceSpan): number {
  return span.start_time ?? Number.NEGATIVE_INFINITY;
}

function lastStarted(spans: readonly TraceSpan[]): TraceSpan | null {
  return spans.reduce<TraceSpan | null>(
    (last, span) => (last === null || startOf(span) >= startOf(last) ? span : last),
    null,
  );
}

function parentsOf(spans: readonly TraceSpan[]): ReadonlyMap<string, string | null> {
  return new Map(spans.map((span) => [span.span_id, span.parent_span_id]));
}

function depthOf(parents: ReadonlyMap<string, string | null>, spanId: string): number {
  let depth = 0;
  let current = parents.get(spanId) ?? null;
  while (current !== null && depth <= parents.size) {
    depth += 1;
    current = parents.get(current) ?? null;
  }
  return depth;
}

function ancestorIdsOf(
  parents: ReadonlyMap<string, string | null>,
  spanId: string,
): ReadonlySet<string> {
  const ancestors = new Set<string>();
  let current = parents.get(spanId) ?? null;
  while (current !== null && !ancestors.has(current)) {
    ancestors.add(current);
    current = parents.get(current) ?? null;
  }
  return ancestors;
}

function stringAttribute(span: TraceSpan, name: string): string | null {
  const value = span.attributes[name];
  return typeof value === "string" ? value : null;
}

function stopPick(
  spans: readonly TraceSpan[],
  reason: string | null,
  code: string | null,
): TraceSpan | null {
  if (reason === STOP_PROVIDER_FAILED && code !== null) {
    return lastStarted(
      spans.filter(
        (span) =>
          span.operation === OPERATION_TURN && span.attributes[ATTRIBUTE_ERROR_TYPE] === code,
      ),
    );
  }
  if (reason === STOP_ENVIRONMENT_FAILED && code === STOP_CODE_COMMAND_ABSENT) {
    return lastStarted(
      spans.filter(
        (span) =>
          span.operation === OPERATION_VERIFICATION &&
          span.attributes[ATTRIBUTE_EXIT_CODE] === EXIT_CODE_COMMAND_NOT_FOUND,
      ),
    );
  }
  if (reason === STOP_NO_PROGRESS) {
    return lastStarted(
      spans.filter(
        (span) => span.operation === OPERATION_TASK && ATTRIBUTE_STOP_REASON in span.attributes,
      ),
    );
  }
  return null;
}

function latestError(spans: readonly TraceSpan[]): TraceSpan | null {
  const parents = parentsOf(spans);
  const parentsOfErrors = new Set(spans.filter(isError).map((span) => span.parent_span_id));
  const candidates = spans.filter(
    (span) => isError(span) && !isStopped(span) && !parentsOfErrors.has(span.span_id),
  );
  return candidates.reduce<TraceSpan | null>((best, span) => {
    if (best === null || endOf(span) > endOf(best)) return span;
    if (endOf(span) < endOf(best)) return best;
    return depthOf(parents, span.span_id) > depthOf(parents, best.span_id) ? span : best;
  }, null);
}

export function pickCausalSpan(spans: readonly TraceSpan[], rootSpanId: string): TraceSpan | null {
  const root = spans.find((span) => span.span_id === rootSpanId);
  if (root === undefined) return null;
  const stop = stopPick(
    spans,
    stringAttribute(root, ATTRIBUTE_STOP_REASON),
    stringAttribute(root, ATTRIBUTE_STOP_CODE),
  );
  if (stop !== null) return stop;
  const evaluation = lastStarted(
    spans.filter(
      (span) =>
        span.operation === OPERATION_EVALUATION &&
        span.attributes[ATTRIBUTE_EVALUATION_RESULT] === RESULT_CRITERION_NOT_MET,
    ),
  );
  return evaluation ?? latestError(spans) ?? root;
}

function stopTimeOf(spans: readonly TraceSpan[]): number | null {
  const root = spans.find((span) => span.parent_span_id === null);
  return root?.end_time ?? null;
}

export function errorRolesOf(
  spans: readonly TraceSpan[],
  causal: TraceSpan | null,
): ReadonlyMap<string, ErrorRole> {
  const stopTime = stopTimeOf(spans);
  const ancestors =
    causal === null ? new Set<string>() : ancestorIdsOf(parentsOf(spans), causal.span_id);
  const roles = new Map<string, ErrorRole>();
  for (const span of spans) {
    if (span.span_id === causal?.span_id) {
      roles.set(span.span_id, ErrorRole.Causal);
      continue;
    }
    const consequence =
      isStopped(span) ||
      (isError(span) &&
        ((stopTime !== null && span.end_time === stopTime) || ancestors.has(span.span_id)));
    if (consequence) roles.set(span.span_id, ErrorRole.Consequence);
    else if (isError(span)) roles.set(span.span_id, ErrorRole.Recovered);
  }
  return roles;
}

export function errorSteps(
  spans: readonly TraceSpan[],
  roles: ReadonlyMap<string, ErrorRole>,
): readonly string[] {
  const parents = parentsOf(spans);
  return spans
    .filter((span) => {
      const role = roles.get(span.span_id);
      return role === ErrorRole.Causal || role === ErrorRole.Consequence;
    })
    .sort((a, b) => {
      if (endOf(a) !== endOf(b)) return endOf(a) < endOf(b) ? -1 : 1;
      return depthOf(parents, b.span_id) - depthOf(parents, a.span_id);
    })
    .map((span) => span.span_id);
}
