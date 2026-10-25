import type { EffectiveCause, TraceSpan } from "@/api/types";

import { errorRolesOf, errorSteps, ErrorRole, pickCausalSpan } from "./causal-span";
import { evidenceOf, taskSpanOf, type EvidenceLine } from "./diagnosis-evidence";
import { namedSpanLabel, revocationLabel } from "./span-labels";
import { causeLabelSpanIdOf, spanCauseOf } from "./trace-cause";

export interface StopFacts {
  readonly reason: string | null;
  readonly code: string | null;
  readonly detail: string | null;
  readonly end: string | null;
  readonly revocation: string | null;
}

export interface SpanDiagnosis {
  readonly cause: EffectiveCause | null;
  readonly labeledBy: string | null;
  readonly labeledAt: number | null;
  readonly causalSpan: TraceSpan | null;
  readonly errorSteps: readonly string[];
  readonly stop: StopFacts;
  readonly recoveredCount: number;
  readonly sentence: string | null;
  readonly evidence: readonly EvidenceLine[];
}

const ATTRIBUTE_STOP_REASON = "kanthord.stop.reason";
const ATTRIBUTE_STOP_CODE = "kanthord.stop.code";
const ATTRIBUTE_STOP_DETAIL = "kanthord.stop.detail";
const ATTRIBUTE_EXECUTION_END = "kanthord.execution.end";
const ATTRIBUTE_ERROR_TYPE = "error.type";
const ATTRIBUTE_EVALUATION_RESULT = "kanthord.evaluation.result";
const STOP_SEPARATOR = " / ";

const NO_STOP: StopFacts = { reason: null, code: null, detail: null, end: null, revocation: null };
const NO_STEPS: readonly string[] = [];

function textOf(span: TraceSpan, name: string): string | null {
  const value = span.attributes[name];
  return typeof value === "string" ? value : null;
}

function stopFactsOf(root: TraceSpan | undefined): StopFacts {
  if (root === undefined) return NO_STOP;
  return {
    reason: textOf(root, ATTRIBUTE_STOP_REASON),
    code: textOf(root, ATTRIBUTE_STOP_CODE),
    detail: textOf(root, ATTRIBUTE_STOP_DETAIL),
    end: textOf(root, ATTRIBUTE_EXECUTION_END),
    revocation: revocationLabel(root),
  };
}

function failureOf(
  causal: TraceSpan,
  byId: ReadonlyMap<string, TraceSpan>,
  taskNames: ReadonlyMap<string, string>,
): string {
  const task = taskSpanOf(byId, causal);
  const place =
    task === null || task === causal
      ? namedSpanLabel(causal, taskNames)
      : `${namedSpanLabel(causal, taskNames)} of ${namedSpanLabel(task, taskNames)}`;
  const reason =
    textOf(causal, ATTRIBUTE_ERROR_TYPE) ?? textOf(causal, ATTRIBUTE_EVALUATION_RESULT);
  return reason === null ? `${place} failed.` : `${place} failed: ${reason}.`;
}

function stopSentenceOf(stop: StopFacts): string | null {
  if (stop.reason === null) return null;
  const code = stop.code === null ? "" : `${STOP_SEPARATOR}${stop.code}`;
  return `The execution stopped: ${stop.reason}${code}.`;
}

function sentenceOf(
  causal: TraceSpan,
  byId: ReadonlyMap<string, TraceSpan>,
  stop: StopFacts,
  taskNames: ReadonlyMap<string, string>,
): string {
  if (stop.revocation !== null) return `${stop.revocation}.`;
  const failure = failureOf(causal, byId, taskNames);
  const stopped = stopSentenceOf(stop);
  return stopped === null ? failure : `${failure} ${stopped}`;
}

export function diagnoseSpans(
  spans: readonly TraceSpan[],
  rootSpanId: string,
  taskNames: ReadonlyMap<string, string>,
): SpanDiagnosis {
  const root = spans.find((span) => span.span_id === rootSpanId);
  const found = spanCauseOf(spans, rootSpanId);
  const cause = found?.cause ?? null;
  const labeledBy = found?.labeledBy ?? null;
  const stop = stopFactsOf(root);
  const causalSpan = cause === null ? null : pickCausalSpan(spans, rootSpanId);
  const roles = errorRolesOf(spans, causalSpan);
  const labelSpanId = causeLabelSpanIdOf(rootSpanId);
  const byId = new Map(spans.map((span) => [span.span_id, span]));
  const evidence =
    cause === null || causalSpan === null || root === undefined
      ? []
      : evidenceOf(cause, { spans, byId, root, causal: causalSpan, taskNames });
  return {
    cause,
    labeledBy,
    labeledAt:
      labeledBy === null
        ? null
        : (spans.find((span) => span.span_id === labelSpanId)?.created_at ?? null),
    causalSpan,
    errorSteps: causalSpan === null ? NO_STEPS : errorSteps(spans, roles),
    stop,
    recoveredCount: [...roles.values()].filter((role) => role === ErrorRole.Recovered).length,
    sentence: causalSpan === null ? null : sentenceOf(causalSpan, byId, stop, taskNames),
    evidence,
  };
}

export function errorStepIndexOf(
  steps: readonly string[],
  causalSpanId: string | null,
  selectedSpanId: string | null,
): number {
  const selected = selectedSpanId === null ? -1 : steps.indexOf(selectedSpanId);
  return selected >= 0 ? selected : steps.indexOf(causalSpanId ?? "");
}
