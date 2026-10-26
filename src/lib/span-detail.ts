import type { SpanAttributeValue, TraceSpan } from "@/api/types";

import { durationText, utcDateTime } from "./format";
import { cacheFacts, costText, percentText, PRICE_LABEL, tokenText } from "./trace-format";
import type { TraceAxis } from "./trace-waterfall";

export interface NamedValue {
  readonly name: string;
  readonly value: string;
  readonly identity?: boolean;
}

export interface SpanEventView {
  readonly name: string;
  readonly time: string;
  readonly attributes: readonly NamedValue[];
}

const OPERATION_TURN = "agent.turn";
const OPERATION_TOOL = "agent.tool";

const ATTRIBUTE_CONVERSATION_ID = "gen_ai.conversation.id";
const ATTRIBUTE_ENTRY_ID = "kanthord.session.entry_id";
const ATTRIBUTE_TOOL_CALL_ID = "gen_ai.tool.call.id";
const ATTRIBUTE_TOOL_NAME = "gen_ai.tool.name";
const ATTRIBUTE_REQUEST_MODEL = "gen_ai.request.model";
const ATTRIBUTE_RESPONSE_MODEL = "gen_ai.response.model";
const ATTRIBUTE_INPUT_TOKENS = "gen_ai.usage.input_tokens";
const ATTRIBUTE_OUTPUT_TOKENS = "gen_ai.usage.output_tokens";
const ATTRIBUTE_CACHE_READ_TOKENS = "gen_ai.usage.cache_read.input_tokens";
const ATTRIBUTE_CACHE_CREATION_TOKENS = "gen_ai.usage.cache_creation.input_tokens";
const ATTRIBUTE_COST_USD = "kanthord.usage.cost_usd";
const ATTRIBUTE_FINISH_REASONS = "gen_ai.response.finish_reasons";
const ATTRIBUTE_MODEL_DURATION_MS = "kanthord.turn.model_duration_ms";

const VALUE_SEPARATOR = ", ";

export function isTurn(span: TraceSpan): boolean {
  return span.operation === OPERATION_TURN;
}

export function isTool(span: TraceSpan): boolean {
  return span.operation === OPERATION_TOOL;
}

function stringAttribute(span: TraceSpan, name: string): string | null {
  const value = span.attributes[name];
  return typeof value === "string" ? value : null;
}

function numberAttribute(span: TraceSpan, name: string): number | null {
  const value = span.attributes[name];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function conversationIdOf(span: TraceSpan): string | null {
  return stringAttribute(span, ATTRIBUTE_CONVERSATION_ID);
}

export function replyEntryIdOf(turn: TraceSpan): string | null {
  return stringAttribute(turn, ATTRIBUTE_ENTRY_ID);
}

export function toolCallIdOf(tool: TraceSpan): string | null {
  return stringAttribute(tool, ATTRIBUTE_TOOL_CALL_ID);
}

export function toolNameOf(tool: TraceSpan): string | null {
  return stringAttribute(tool, ATTRIBUTE_TOOL_NAME);
}

export function attributeText(value: SpanAttributeValue): string {
  return typeof value === "object" ? value.join(VALUE_SEPARATOR) : String(value);
}

export function attributesOf(
  attributes: Readonly<Record<string, SpanAttributeValue>>,
): readonly NamedValue[] {
  return Object.entries(attributes).map(([name, value]) => ({ name, value: attributeText(value) }));
}

export function eventsOf(span: TraceSpan): readonly SpanEventView[] {
  return span.events.map((event) => ({
    name: event.name,
    time: utcDateTime(event.time),
    attributes: attributesOf(event.attributes ?? {}),
  }));
}

function fact(name: string, value: string | null): readonly NamedValue[] {
  return value === null ? [] : [{ name, value }];
}

function formatted(value: number | null, format: (value: number) => string): string | null {
  return value === null ? null : format(value);
}

export function spanFacts(span: TraceSpan, axis: TraceAxis | null): readonly NamedValue[] {
  const { start_time: start, end_time: end } = span;
  return [
    ...fact("Start", formatted(start, utcDateTime)),
    ...fact("End", formatted(end, utcDateTime)),
    ...fact("Duration", start === null || end === null ? null : durationText(end - start)),
    ...fact("Offset", start === null || axis === null ? null : durationText(start - axis.start)),
  ];
}

function cacheHitText(
  input: number | null,
  read: number | null,
  write: number | null,
): string | null {
  if (input === null || read === null) return null;
  return percentText(cacheFacts(input, read, write ?? 0).hitRatio);
}

function finishReason(span: TraceSpan): string | null {
  const value = span.attributes[ATTRIBUTE_FINISH_REASONS];
  return value === undefined ? null : attributeText(value);
}

export function turnFacts(turn: TraceSpan): readonly NamedValue[] {
  const input = numberAttribute(turn, ATTRIBUTE_INPUT_TOKENS);
  const read = numberAttribute(turn, ATTRIBUTE_CACHE_READ_TOKENS);
  const write = numberAttribute(turn, ATTRIBUTE_CACHE_CREATION_TOKENS);
  return [
    ...fact(
      "Model",
      stringAttribute(turn, ATTRIBUTE_RESPONSE_MODEL) ??
        stringAttribute(turn, ATTRIBUTE_REQUEST_MODEL),
    ),
    ...fact("Input tokens", formatted(input, tokenText)),
    ...fact("Output tokens", formatted(numberAttribute(turn, ATTRIBUTE_OUTPUT_TOKENS), tokenText)),
    ...fact("Cache read", formatted(read, tokenText)),
    ...fact("Cache write", formatted(write, tokenText)),
    ...fact("Cache hit", cacheHitText(input, read, write)),
    ...fact(PRICE_LABEL, formatted(numberAttribute(turn, ATTRIBUTE_COST_USD), costText)),
    ...fact("Finish reason", finishReason(turn)),
    ...fact(
      "Model duration",
      formatted(numberAttribute(turn, ATTRIBUTE_MODEL_DURATION_MS), durationText),
    ),
  ];
}
