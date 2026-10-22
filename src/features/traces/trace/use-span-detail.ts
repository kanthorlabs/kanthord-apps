import { useEffect, useState } from "react";

import { ApiError } from "@/api/errors";
import { listSessionEntryPage, readSessionEntry, readTraceText } from "@/api/resources/tracking";
import type { TraceSessionEntry, TraceSpan, TraceSpanLink } from "@/api/types";
import { asApiError, useResource, type Resource } from "@/hooks/use-resource";
import { entryView, toolCallIn, type EntryView } from "@/lib/session-entries";
import {
  attributesOf,
  conversationIdOf,
  eventsOf,
  isTool,
  isTurn,
  replyEntryIdOf,
  spanFacts,
  toolCallIdOf,
  turnFacts,
  type NamedValue,
  type SpanEventView,
} from "@/lib/span-detail";
import { traceAxis } from "@/lib/trace-waterfall";

export type Loadable<T> =
  | { readonly status: "loading" }
  | { readonly status: "absent" }
  | { readonly status: "failed"; readonly message: string }
  | { readonly status: "ready"; readonly value: T };

export interface ReplyToolCall {
  readonly id: string;
  readonly name: string;
  readonly toolSpan: TraceSpan | null;
}

export interface ModelReply {
  readonly text: string;
  readonly thinking: readonly string[];
  readonly toolCalls: readonly ReplyToolCall[];
}

export interface ToolResult {
  readonly isError: boolean;
  readonly text: string;
}

export interface SpanText {
  readonly name: string;
  readonly state: Loadable<string>;
}

export interface SpanDetailState {
  readonly facts: readonly NamedValue[];
  readonly attributes: readonly NamedValue[];
  readonly events: readonly SpanEventView[];
  readonly links: readonly TraceSpanLink[];
  readonly texts: readonly SpanText[];
  readonly modelReply: Loadable<ModelReply> | null;
  readonly toolArguments: Loadable<string> | null;
  readonly toolResult: Loadable<ToolResult> | null;
}

interface EntryRef {
  readonly sessionId: string;
  readonly entryId: string;
}

interface ResultRef {
  readonly sessionId: string;
  readonly toolCallId: string;
}

const LOADING = { status: "loading" } as const;
const ABSENT = { status: "absent" } as const;
const TEXT_ID_SEPARATOR = "\n";
const NAME_SEPARATOR = ":";

function failed(message: string): Loadable<never> {
  return { status: "failed", message };
}

async function readEntry(
  read: () => Promise<TraceSessionEntry | undefined>,
): Promise<Loadable<EntryView>> {
  try {
    const entry = await read();
    return entry === undefined ? ABSENT : { status: "ready", value: entryView(entry) };
  } catch (cause) {
    if (cause instanceof ApiError && cause.code === "not_found") return ABSENT;
    throw cause;
  }
}

function settled<T>(resource: Resource<Loadable<T>>): Loadable<T> {
  if (resource.error !== null) return failed(resource.error.message);
  return resource.data ?? LOADING;
}

function whenReady<T, U>(state: Loadable<T>, map: (value: T) => Loadable<U>): Loadable<U> {
  return state.status === "ready" ? map(state.value) : state;
}

function turnOf(span: TraceSpan, spans: readonly TraceSpan[]): TraceSpan | null {
  if (isTurn(span)) return span;
  if (!isTool(span)) return null;
  return spans.find((other) => other.span_id === span.parent_span_id && isTurn(other)) ?? null;
}

function replyRefOf(span: TraceSpan, spans: readonly TraceSpan[]): EntryRef | null {
  const turn = turnOf(span, spans);
  const sessionId = conversationIdOf(span);
  const entryId = turn === null ? null : replyEntryIdOf(turn);
  return sessionId === null || entryId === null ? null : { sessionId, entryId };
}

function resultRefOf(span: TraceSpan): ResultRef | null {
  const sessionId = conversationIdOf(span);
  const toolCallId = toolCallIdOf(span);
  if (!isTool(span) || sessionId === null || toolCallId === null) return null;
  return { sessionId, toolCallId };
}

function toolSpanOf(
  spans: readonly TraceSpan[],
  turn: TraceSpan,
  callId: string,
): TraceSpan | null {
  return (
    spans.find(
      (other) =>
        isTool(other) && other.parent_span_id === turn.span_id && toolCallIdOf(other) === callId,
    ) ?? null
  );
}

function replyOf(
  view: EntryView,
  turn: TraceSpan,
  spans: readonly TraceSpan[],
): Loadable<ModelReply> {
  if (view.kind !== "assistant") return failed("The entry holds no model reply.");
  return {
    status: "ready",
    value: {
      text: view.text,
      thinking: view.thinking,
      toolCalls: view.toolCalls.map((call) => ({
        id: call.id,
        name: call.name,
        toolSpan: toolSpanOf(spans, turn, call.id),
      })),
    },
  };
}

function argumentsOf(view: EntryView, toolCallId: string | null): Loadable<string> {
  const call = toolCallId === null ? null : toolCallIn(view, toolCallId);
  if (call === null) return failed("The reply holds no call with this id.");
  return { status: "ready", value: JSON.stringify(call.arguments ?? null, null, 2) };
}

function resultOf(view: EntryView): Loadable<ToolResult> {
  if (view.kind !== "tool_result") return failed("The entry holds no tool result.");
  return { status: "ready", value: { isError: view.isError, text: view.text } };
}

function textNameOf(textId: string): string {
  return textId.slice(textId.lastIndexOf(NAME_SEPARATOR) + 1);
}

function useTexts(traceId: string, textIds: readonly string[]): readonly SpanText[] {
  const idsKey = textIds.join(TEXT_ID_SEPARATOR);
  const [states, setStates] = useState<ReadonlyMap<string, Loadable<string>>>(new Map());

  useEffect(() => {
    let live = true;
    const settle = (textId: string, state: Loadable<string>) => {
      if (live) setStates((current) => new Map(current).set(textId, state));
    };
    const ids = idsKey === "" ? [] : idsKey.split(TEXT_ID_SEPARATOR);
    for (const textId of ids) {
      readTraceText(traceId, textId).then(
        (text) => settle(textId, { status: "ready", value: text.content }),
        (cause: unknown) => settle(textId, failed(asApiError(cause).message)),
      );
    }
    return () => {
      live = false;
    };
  }, [traceId, idsKey]);

  return textIds.map((textId) => ({
    name: textNameOf(textId),
    state: states.get(textId) ?? LOADING,
  }));
}

export function useSpanDetail(
  traceId: string,
  span: TraceSpan,
  spans: readonly TraceSpan[],
): SpanDetailState {
  const replyRef = replyRefOf(span, spans);
  const resultRef = resultRefOf(span);
  const turn = turnOf(span, spans);

  const replyEntry = useResource(
    async () =>
      replyRef === null
        ? LOADING
        : readEntry(async () => readSessionEntry(traceId, replyRef.sessionId, replyRef.entryId)),
    [traceId, replyRef?.sessionId, replyRef?.entryId],
  );
  const resultEntry = useResource(
    async () =>
      resultRef === null
        ? LOADING
        : readEntry(
            async () =>
              (
                await listSessionEntryPage(
                  traceId,
                  resultRef.sessionId,
                  null,
                  1,
                  resultRef.toolCallId,
                )
              ).items[0],
          ),
    [traceId, resultRef?.sessionId, resultRef?.toolCallId],
  );
  const texts = useTexts(traceId, span.text_ids);

  const reply = settled(replyEntry);
  const isTurnSpan = isTurn(span);
  const isToolSpan = isTool(span);
  return {
    facts: [...spanFacts(span, traceAxis(spans)), ...(isTurnSpan ? turnFacts(span) : [])],
    attributes: attributesOf(span.attributes),
    events: eventsOf(span),
    links: span.links,
    texts,
    modelReply:
      isTurnSpan && replyRef !== null && turn !== null
        ? whenReady(reply, (view) => replyOf(view, turn, spans))
        : null,
    toolArguments:
      isToolSpan && replyRef !== null
        ? whenReady(reply, (view) => argumentsOf(view, toolCallIdOf(span)))
        : null,
    toolResult: resultRef === null ? null : whenReady(settled(resultEntry), resultOf),
  };
}
