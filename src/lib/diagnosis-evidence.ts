import type { CauseCategory, EffectiveCause, SpanAttributeValue, TraceSpan } from "@/api/types";

import { promptPartsOf } from "./agent-prompt-parts";
import { utcDateTime } from "./format";
import { revocationLabel, spanLabel } from "./span-labels";

export const EVIDENCE_LIMIT = 4;

export interface EvidenceLine {
  readonly text: string;
  readonly spanId: string;
}

export interface EvidenceContext {
  readonly spans: readonly TraceSpan[];
  readonly byId: ReadonlyMap<string, TraceSpan>;
  readonly root: TraceSpan;
  readonly causal: TraceSpan;
}

type Builder = (context: EvidenceContext) => readonly EvidenceLine[];

const OPERATION_PROMPT = "agent.prompt";
const OPERATION_TASK = "worker.task";
const OPERATION_TURN = "agent.turn";
const OPERATION_EVALUATION = "worker.evaluation";
const OPERATION_VERIFICATION = "worker.verification";
const OPERATION_GATE = "worker.gate";
const OPERATION_GIT = "worker.git";
const ENVIRONMENT_PREFIX = "environment.";
const ATTRIBUTE_STOP_DETAIL = "kanthord.stop.detail";
const ATTRIBUTE_EXECUTION_END = "kanthord.execution.end";
const ATTRIBUTE_ERROR_TYPE = "error.type";
const ATTRIBUTE_EXIT_CODE = "process.exit.code";
const ATTRIBUTE_PROVIDER = "gen_ai.provider.name";
const ATTRIBUTE_RESPONSE_MODEL = "gen_ai.response.model";
const ATTRIBUTE_REQUEST_MODEL = "gen_ai.request.model";
const ATTRIBUTE_FINISH_REASONS = "gen_ai.response.finish_reasons";
const ATTRIBUTE_TEMPLATE = "kanthord.prompt.template";
const TEMPLATE_TASK_REVISION = "task-revision";
const EXECUTION_LOST = "lost";
const DETAIL_LIMIT = 160;

function line(span: TraceSpan, text: string): EvidenceLine {
  return { text, spanId: span.span_id };
}

function valueText(value: SpanAttributeValue | undefined): string | null {
  if (value === undefined) return null;
  return typeof value === "object" ? value.join(", ") : String(value);
}

function attributeText(span: TraceSpan, name: string): string | null {
  return valueText(span.attributes[name]);
}

function countText(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function turnsOf(spans: readonly TraceSpan[]): readonly TraceSpan[] {
  return spans.filter((span) => span.operation === OPERATION_TURN);
}

export function taskSpanOf(
  byId: ReadonlyMap<string, TraceSpan>,
  span: TraceSpan,
): TraceSpan | null {
  let current: TraceSpan | undefined = span;
  for (let steps = 0; current !== undefined && steps <= byId.size; steps += 1) {
    if (current.operation === OPERATION_TASK) return current;
    current = current.parent_span_id === null ? undefined : byId.get(current.parent_span_id);
  }
  return null;
}

function stopDetailLines({ root }: EvidenceContext): readonly EvidenceLine[] {
  const detail = attributeText(root, ATTRIBUTE_STOP_DETAIL);
  if (detail === null) return [];
  const shown = detail.length > DETAIL_LIMIT ? `${detail.slice(0, DETAIL_LIMIT)}...` : detail;
  return [line(root, `Stop detail: ${shown}`)];
}

function replyLines({ causal }: EvidenceContext): readonly EvidenceLine[] {
  return causal.operation === OPERATION_TURN ? [line(causal, `Reply of ${spanLabel(causal)}`)] : [];
}

function rationaleLines({ spans }: EvidenceContext): readonly EvidenceLine[] {
  return spans
    .filter((span) => span.operation === OPERATION_EVALUATION)
    .map((span) => line(span, `Rationale of ${spanLabel(span)}`));
}

function taskTurnLines({ spans, byId }: EvidenceContext): readonly EvidenceLine[] {
  const counts = new Map<TraceSpan, number>();
  for (const turn of turnsOf(spans)) {
    const task = taskSpanOf(byId, turn);
    if (task !== null) counts.set(task, (counts.get(task) ?? 0) + 1);
  }
  return [...counts].map(([task, count]) =>
    line(task, `${spanLabel(task)}: ${countText(count, "turn")}`),
  );
}

function revisionTurnLines({ spans }: EvidenceContext): readonly EvidenceLine[] {
  const revisions = turnsOf(spans).filter(
    (span) => span.attributes[ATTRIBUTE_TEMPLATE] === TEMPLATE_TASK_REVISION,
  );
  const first = revisions[0];
  return first === undefined
    ? []
    : [line(first, countText(revisions.length, "task-revision turn"))];
}

function promptEvidence(context: EvidenceContext): readonly EvidenceLine[] {
  const { spans, byId, causal } = context;
  const layers = spans
    .filter((span) => span.operation === OPERATION_PROMPT)
    .flatMap((span) => {
      const parts = promptPartsOf(span);
      return parts.length === 0
        ? []
        : [line(span, `Prompt layers: ${parts.map((p) => `${p.part}:${p.name}`).join(", ")}`)];
    });
  const task = taskSpanOf(byId, causal);
  const work = task === null ? [] : [line(task, `Work prompt of ${spanLabel(task)}`)];
  return [...layers, ...work, ...replyLines(context)];
}

function planEvidence(context: EvidenceContext): readonly EvidenceLine[] {
  return [...rationaleLines(context), ...taskTurnLines(context)];
}

function workerActionEvidence(context: EvidenceContext): readonly EvidenceLine[] {
  const { causal } = context;
  const failedStep = causal.operation === OPERATION_GATE || causal.operation === OPERATION_GIT;
  return [
    ...(failedStep ? [line(causal, `Error text of ${spanLabel(causal)}`)] : []),
    ...stopDetailLines(context),
  ];
}

function providerEvidence(context: EvidenceContext): readonly EvidenceLine[] {
  const { causal } = context;
  const errorType = attributeText(causal, ATTRIBUTE_ERROR_TYPE);
  const provider = attributeText(causal, ATTRIBUTE_PROVIDER);
  const model =
    attributeText(causal, ATTRIBUTE_RESPONSE_MODEL) ??
    attributeText(causal, ATTRIBUTE_REQUEST_MODEL);
  const facts = [
    provider === null ? null : `Provider ${provider}`,
    model === null ? null : `Model ${model}`,
  ].filter((fact) => fact !== null);
  return [
    ...(errorType === null
      ? []
      : [line(causal, `${spanLabel(causal)} ${ATTRIBUTE_ERROR_TYPE} ${errorType}`)]),
    ...stopDetailLines(context),
    ...(facts.length === 0 ? [] : [line(causal, facts.join(", "))]),
  ];
}

function modelEvidence(context: EvidenceContext): readonly EvidenceLine[] {
  const { causal } = context;
  const finish = attributeText(causal, ATTRIBUTE_FINISH_REASONS);
  return [
    ...replyLines(context),
    ...(finish === null ? [] : [line(causal, `Finish reasons: ${finish}`)]),
    ...rationaleLines(context),
    ...revisionTurnLines(context),
  ];
}

function environmentEvidence({ spans, causal }: EvidenceContext): readonly EvidenceLine[] {
  const exitCode = attributeText(causal, ATTRIBUTE_EXIT_CODE);
  const verification =
    causal.operation === OPERATION_VERIFICATION
      ? [
          line(
            causal,
            `${spanLabel(causal)}: command and output${exitCode === null ? "" : `, exit code ${exitCode}`}`,
          ),
        ]
      : [];
  const failedSetup = spans
    .filter((span) => span.operation.startsWith(ENVIRONMENT_PREFIX) && span.status === "Error")
    .map((span) => line(span, `${spanLabel(span)} ended with Error`));
  return [...verification, ...failedSetup];
}

function lastEndedSpan(spans: readonly TraceSpan[]): TraceSpan | null {
  return spans.reduce<TraceSpan | null>((latest, span) => {
    if (span.end_time === null) return latest;
    return latest === null || span.end_time > (latest.end_time ?? 0) ? span : latest;
  }, null);
}

function infrastructureEvidence(context: EvidenceContext): readonly EvidenceLine[] {
  const { spans, root } = context;
  const last = lastEndedSpan(spans);
  const lost = attributeText(root, ATTRIBUTE_EXECUTION_END) === EXECUTION_LOST;
  const endTime = last?.end_time ?? null;
  return [
    ...stopDetailLines(context),
    ...(lost && last !== null && endTime !== null
      ? [line(last, `Last record ${utcDateTime(endTime)}`)]
      : []),
  ];
}

function humanEvidence({ root }: EvidenceContext): readonly EvidenceLine[] {
  const revocation = revocationLabel(root);
  return revocation === null ? [] : [line(root, revocation)];
}

const BUILDERS: Readonly<Record<CauseCategory, Builder>> = {
  prompt: promptEvidence,
  plan: planEvidence,
  worker_action: workerActionEvidence,
  llm_provider: providerEvidence,
  model: modelEvidence,
  environment: environmentEvidence,
  infrastructure: infrastructureEvidence,
  human: humanEvidence,
  unattributed: () => [],
};

export function evidenceOf(
  cause: EffectiveCause,
  context: EvidenceContext,
): readonly EvidenceLine[] {
  const categories = cause.category === "unattributed" ? (cause.suspects ?? []) : [cause.category];
  const seen = new Set<string>();
  return categories
    .flatMap((category) => BUILDERS[category](context))
    .filter((entry) => {
      const key = `${entry.spanId}|${entry.text}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, EVIDENCE_LIMIT);
}
