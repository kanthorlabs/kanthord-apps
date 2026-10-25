import type { SpanAttributeValue, TraceSpan, TraceSummary } from "@/api/types";

import { conversationIdOf, isTool, isTurn } from "./span-detail";

export const TimeLine = {
  ModelCalls: "model_calls",
  ToolLatency: "tool_latency",
  VerificationTime: "verification_time",
  Git: "git",
  WorkerOther: "worker_other",
} as const;

export type TimeLine = (typeof TimeLine)[keyof typeof TimeLine];

export const TIME_LINE_LABELS: Readonly<Record<TimeLine, string>> = {
  model_calls: "Model calls",
  tool_latency: "tool_latency",
  verification_time: "verification_time",
  git: "Git",
  worker_other: "Worker other",
};

export interface TimeBreakdownLine {
  readonly line: TimeLine;
  readonly ms: number;
  readonly share: number;
}

export interface TimeBreakdown {
  readonly totalMs: number;
  readonly lines: readonly TimeBreakdownLine[];
  readonly queueWaitMs: number | null;
}

export interface TurnInputTokens {
  readonly spanId: string;
  readonly index: number;
  readonly inputTokens: number;
}

type Interval = readonly [number, number];

const OPERATION_VERIFICATION = "worker.verification";
const OPERATION_GIT = "worker.git";
const OPERATION_GATE = "worker.gate";

const ATTRIBUTE_QUEUE_WAIT_MS = "kanthord.queue.wait_ms";
const ATTRIBUTE_TURN_INDEX = "kanthord.turn.index";
const ATTRIBUTE_INPUT_TOKENS = "gen_ai.usage.input_tokens";

export function unionMs(intervals: readonly Interval[]): number {
  const sorted = intervals.filter(([start, end]) => end > start).sort((a, b) => a[0] - b[0]);
  let total = 0;
  let reach = Number.NEGATIVE_INFINITY;
  for (const [start, end] of sorted) {
    total += Math.max(0, end - Math.max(start, reach));
    reach = Math.max(reach, end);
  }
  return total;
}

function intervalsOf(
  spans: readonly TraceSpan[],
  matches: (span: TraceSpan) => boolean,
  now: number,
): readonly Interval[] {
  return spans
    .filter(matches)
    .flatMap((span) =>
      span.start_time === null ? [] : [[span.start_time, span.end_time ?? now] as const],
    );
}

function numberAttribute(
  attributes: Readonly<Record<string, SpanAttributeValue>>,
  name: string,
): number | null {
  const value = attributes[name];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function totalMsOf(summary: TraceSummary, now: number): number {
  if (summary.duration_ms !== null) return summary.duration_ms;
  return summary.started_at === null ? 0 : Math.max(0, now - summary.started_at);
}

export function timeBreakdown(
  summary: TraceSummary,
  spans: readonly TraceSpan[],
  now: number,
): TimeBreakdown {
  const turns = intervalsOf(spans, isTurn, now);
  const tools = intervalsOf(spans, isTool, now);
  const verifications = intervalsOf(
    spans,
    (span) => span.operation === OPERATION_VERIFICATION,
    now,
  );
  const git = intervalsOf(
    spans,
    (span) => span.operation === OPERATION_GIT || span.operation === OPERATION_GATE,
    now,
  );
  const toolMs = unionMs(tools);
  const modelMs = unionMs([...turns, ...tools]) - toolMs;
  const accountedMs = unionMs([...turns, ...tools, ...verifications, ...git]);
  const totalMs = totalMsOf(summary, now);
  const msByLine: Readonly<Record<TimeLine, number>> = {
    model_calls: modelMs,
    tool_latency: toolMs,
    verification_time: unionMs(verifications),
    git: unionMs(git),
    worker_other: Math.max(0, totalMs - accountedMs),
  };
  const rootAttributes =
    spans.find((span) => span.span_id === summary.root_span_id)?.attributes ??
    summary.root_attributes;
  return {
    totalMs,
    lines: Object.values(TimeLine).map((line) => ({
      line,
      ms: msByLine[line],
      share: totalMs > 0 ? msByLine[line] / totalMs : 0,
    })),
    queueWaitMs:
      rootAttributes === null ? null : numberAttribute(rootAttributes, ATTRIBUTE_QUEUE_WAIT_MS),
  };
}

export function turnInputTokens(
  spans: readonly TraceSpan[],
  sessionSpanId: string | null,
): readonly TurnInputTokens[] {
  if (sessionSpanId === null) return [];
  return spans
    .filter((span) => isTurn(span) && conversationIdOf(span) === sessionSpanId)
    .map((span) => ({
      spanId: span.span_id,
      index: numberAttribute(span.attributes, ATTRIBUTE_TURN_INDEX) ?? 0,
      inputTokens: numberAttribute(span.attributes, ATTRIBUTE_INPUT_TOKENS) ?? 0,
    }))
    .sort((a, b) => a.index - b.index);
}
