import type { TraceSpan } from "@/api/types";

import { conversationIdOf, isTurn } from "./span-detail";
import { tokenText } from "./trace-format";
import { turnInputTokens } from "./trace-time";

const OPERATION_SESSION = "agent.session";
const FULL_PERCENT = 100;

export interface TurnTokenRow {
  readonly spanId: string;
  readonly index: number;
  readonly tokens: string;
  readonly percent: number;
  readonly selected: boolean;
}

function sessionSpanIdOf(span: TraceSpan): string | null {
  if (span.operation === OPERATION_SESSION) return span.span_id;
  return isTurn(span) ? conversationIdOf(span) : null;
}

export function turnTokenRows(
  span: TraceSpan,
  spans: readonly TraceSpan[],
): readonly TurnTokenRow[] {
  const turns = turnInputTokens(spans, sessionSpanIdOf(span));
  const largest = Math.max(0, ...turns.map((turn) => turn.inputTokens));
  return turns.map((turn) => ({
    spanId: turn.spanId,
    index: turn.index,
    tokens: tokenText(turn.inputTokens),
    percent: largest === 0 ? 0 : (turn.inputTokens / largest) * FULL_PERCENT,
    selected: turn.spanId === span.span_id,
  }));
}
