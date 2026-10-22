import type { TraceSpan } from "@/api/types";

import { buildSpanTree, type SpanNode } from "./trace-tree";

export type SpanUsage = { tokens: number; costUsd: number };

const OPERATION_TURN = "agent.turn";
const OPERATION_TASK = "worker.task";
const OPERATION_JUDGEMENT = "worker.judgement";
const OPERATION_SESSION = "agent.session";

const ATTRIBUTE_INPUT_TOKENS = "gen_ai.usage.input_tokens";
const ATTRIBUTE_OUTPUT_TOKENS = "gen_ai.usage.output_tokens";
const ATTRIBUTE_COST_USD = "kanthord.usage.cost_usd";
const ATTRIBUTE_CONVERSATION_ID = "gen_ai.conversation.id";

function numberOf(span: TraceSpan, attribute: string): number {
  const value = span.attributes[attribute];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function turnUsage(span: TraceSpan): SpanUsage {
  return {
    tokens: numberOf(span, ATTRIBUTE_INPUT_TOKENS) + numberOf(span, ATTRIBUTE_OUTPUT_TOKENS),
    costUsd: numberOf(span, ATTRIBUTE_COST_USD),
  };
}

function add(a: SpanUsage, b: SpanUsage): SpanUsage {
  return { tokens: a.tokens + b.tokens, costUsd: a.costUsd + b.costUsd };
}

function sumUsage(usages: readonly SpanUsage[]): SpanUsage {
  return usages.reduce(add, { tokens: 0, costUsd: 0 });
}

function turnsBelow(node: SpanNode, usage: Map<string, SpanUsage>): SpanUsage {
  const own = node.span.operation === OPERATION_TURN ? turnUsage(node.span) : null;
  const below = sumUsage(node.children.map((child) => turnsBelow(child, usage)));
  const operation = node.span.operation;
  if (operation === OPERATION_TASK || operation === OPERATION_JUDGEMENT) {
    usage.set(node.span.span_id, below);
  }
  return own === null ? below : add(own, below);
}

function turnUsageByConversation(spans: readonly TraceSpan[]): Map<string, SpanUsage[]> {
  const groups = new Map<string, SpanUsage[]>();
  for (const span of spans) {
    if (span.operation !== OPERATION_TURN) continue;
    const conversation = span.attributes[ATTRIBUTE_CONVERSATION_ID];
    if (typeof conversation !== "string") continue;
    groups.set(conversation, [...(groups.get(conversation) ?? []), turnUsage(span)]);
  }
  return groups;
}

export function usageBySpan(spans: readonly TraceSpan[]): ReadonlyMap<string, SpanUsage> {
  const usage = new Map<string, SpanUsage>();
  for (const root of buildSpanTree(spans)) turnsBelow(root, usage);
  for (const span of spans) {
    if (span.operation === OPERATION_TURN) usage.set(span.span_id, turnUsage(span));
  }
  const conversations = turnUsageByConversation(spans);
  for (const span of spans) {
    if (span.operation !== OPERATION_SESSION) continue;
    usage.set(span.span_id, sumUsage(conversations.get(span.span_id) ?? []));
  }
  return usage;
}
