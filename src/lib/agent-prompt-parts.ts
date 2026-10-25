import type { TraceSessionEntry, TraceSpan } from "@/api/types";

import { entryView } from "./session-entries";
import { conversationIdOf, isTurn, replyEntryIdOf } from "./span-detail";

export interface PromptPartRef {
  readonly part: string;
  readonly name: string;
  readonly digest: string;
}

const OPERATION_PROMPT = "agent.prompt";
const OPERATION_TASK = "worker.task";
const ATTRIBUTE_AGENT_NAME = "kanthord.agent.name";
const ATTRIBUTE_PROMPT_PARTS = "kanthord.prompt.parts";
const ATTRIBUTE_TEMPLATES_DIGEST = "kanthord.prompt.templates_digest";
const ATTRIBUTE_TEMPLATE = "kanthord.prompt.template";
const PART_SEPARATOR = ":";
const PART_FIELD_COUNT = 3;
const TYPE_CUSTOM = "custom";
const CUSTOM_PINNED_CONTEXT = "kanthord.pinned_context";

function startOf(span: TraceSpan): number {
  return span.start_time ?? Number.POSITIVE_INFINITY;
}

function partOf(item: string): PromptPartRef | null {
  const fields = item.split(PART_SEPARATOR);
  if (fields.length !== PART_FIELD_COUNT || fields.some((field) => field === "")) return null;
  const [part = "", name = "", digest = ""] = fields;
  return { part, name, digest };
}

export function promptPartsOf(span: TraceSpan): readonly PromptPartRef[] {
  const items = span.attributes[ATTRIBUTE_PROMPT_PARTS];
  if (!Array.isArray(items)) return [];
  return items.flatMap((item: unknown) => {
    const parsed = typeof item === "string" ? partOf(item) : null;
    return parsed === null ? [] : [parsed];
  });
}

function promptSpansByAgent(spans: readonly TraceSpan[]): ReadonlyMap<string, TraceSpan> {
  const byAgent = new Map<string, TraceSpan>();
  for (const span of spans) {
    const name = span.attributes[ATTRIBUTE_AGENT_NAME];
    if (span.operation !== OPERATION_PROMPT || typeof name !== "string") continue;
    if (!byAgent.has(name)) byAgent.set(name, span);
  }
  return byAgent;
}

function digestsOf(span: TraceSpan): ReadonlyMap<string, string> {
  return new Map(
    promptPartsOf(span).map(({ part, name, digest }) => [
      `${part}${PART_SEPARATOR}${name}`,
      digest,
    ]),
  );
}

function differs(previous: TraceSpan, current: TraceSpan): boolean {
  if (
    previous.attributes[ATTRIBUTE_TEMPLATES_DIGEST] !==
    current.attributes[ATTRIBUTE_TEMPLATES_DIGEST]
  )
    return true;
  const before = digestsOf(previous);
  const after = digestsOf(current);
  const keys = new Set([...before.keys(), ...after.keys()]);
  return [...keys].some((key) => before.get(key) !== after.get(key));
}

export function promptChanged(
  previous: readonly TraceSpan[],
  current: readonly TraceSpan[],
): boolean {
  const before = promptSpansByAgent(previous);
  return [...promptSpansByAgent(current)].some(([name, span]) => {
    const earlier = before.get(name);
    return earlier !== undefined && differs(earlier, span);
  });
}

function firstTurnOf(spans: readonly TraceSpan[], task: TraceSpan): TraceSpan | null {
  const turns = spans.filter((span) => isTurn(span) && span.parent_span_id === task.span_id);
  return turns.reduce<TraceSpan | null>(
    (first, turn) => (first === null || startOf(turn) < startOf(first) ? turn : first),
    null,
  );
}

function tasksOf(spans: readonly TraceSpan[]): readonly TraceSpan[] {
  return spans.filter((span) => span.operation === OPERATION_TASK);
}

export function taskTemplates(spans: readonly TraceSpan[]): ReadonlyMap<string, string> {
  const templates = new Map<string, string>();
  for (const task of tasksOf(spans)) {
    const template = firstTurnOf(spans, task)?.attributes[ATTRIBUTE_TEMPLATE];
    if (typeof template === "string") templates.set(task.span_id, template);
  }
  return templates;
}

function workPromptEntryId(entries: readonly TraceSessionEntry[], turn: TraceSpan): string | null {
  const sessionId = conversationIdOf(turn);
  const replyId = replyEntryIdOf(turn);
  const reply = entries.find(
    (entry) => entry.session_id === sessionId && entry.entry_id === replyId,
  );
  if (reply === undefined) return null;
  const before = entries
    .filter(
      (entry) =>
        entry.session_id === sessionId &&
        entry.sequence < reply.sequence &&
        entryView(entry).kind === "user",
    )
    .sort((a, b) => b.sequence - a.sequence);
  return before[0]?.entry_id ?? null;
}

export function workPromptEntryIds(
  spans: readonly TraceSpan[],
  entries: readonly TraceSessionEntry[],
): ReadonlyMap<string, string> {
  const ids = new Map<string, string>();
  for (const task of tasksOf(spans)) {
    const turn = firstTurnOf(spans, task);
    const entryId = turn === null ? null : workPromptEntryId(entries, turn);
    if (entryId !== null) ids.set(task.span_id, entryId);
  }
  return ids;
}

export function pinnedContextEntryIds(entries: readonly TraceSessionEntry[]): readonly string[] {
  return entries
    .filter(
      (entry) =>
        entry.entry.type === TYPE_CUSTOM && entry.entry.customType === CUSTOM_PINNED_CONTEXT,
    )
    .map((entry) => entry.entry_id);
}
