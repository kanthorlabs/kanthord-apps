import type { PromptReference, TraceSessionEntry, TraceSpan } from "@/api/types";
import { PROMPT_ORIGINS, PROMPT_PART_KINDS } from "@/api/types";

import { entryView } from "./session-entries";
import { conversationIdOf, isTurn, replyEntryIdOf } from "./span-detail";

const OPERATION_PROMPT = "agent.prompt";
const OPERATION_TASK = "worker.task";
const ATTRIBUTE_AGENT_NAME = "kanthord.agent.name";
const ATTRIBUTE_PROMPT_SOURCES = "kanthord.prompt.sources";
const ATTRIBUTE_TEMPLATES_DIGEST = "kanthord.prompt.templates_digest";
const ATTRIBUTE_TEMPLATE = "kanthord.prompt.template";
const KEY_SEPARATOR = ":";
const TYPE_CUSTOM = "custom";
const CUSTOM_PINNED_CONTEXT = "kanthord.pinned_context";

type Json = Readonly<Record<string, unknown>>;

function startOf(span: TraceSpan): number {
  return span.start_time ?? Number.POSITIVE_INFINITY;
}

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableText(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function includes<T extends string>(set: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (set as readonly string[]).includes(value);
}

function parsed(item: string): unknown {
  try {
    return JSON.parse(item);
  } catch {
    return null;
  }
}

function referenceOf(item: unknown): PromptReference | null {
  const value = typeof item === "string" ? parsed(item) : null;
  if (!isRecord(value)) return null;
  const { part, name, origin, path, binding_id: bindingId, commit, digest } = value;
  if (!includes(PROMPT_PART_KINDS, part) || !includes(PROMPT_ORIGINS, origin)) return null;
  if (typeof name !== "string" || name === "" || typeof digest !== "string") return null;
  if (!isNullableText(path) || !isNullableText(bindingId) || !isNullableText(commit)) return null;
  return { part, name, origin, path, binding_id: bindingId, commit, digest };
}

export function promptPartKey(part: Pick<PromptReference, "part" | "name">): string {
  return `${part.part}${KEY_SEPARATOR}${part.name}`;
}

export function promptSourcesOf(span: TraceSpan): readonly PromptReference[] {
  const items = span.attributes[ATTRIBUTE_PROMPT_SOURCES];
  if (!Array.isArray(items)) return [];
  return items.flatMap((item: unknown) => {
    const reference = referenceOf(item);
    return reference === null ? [] : [reference];
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
  return new Map(promptSourcesOf(span).map((source) => [promptPartKey(source), source.digest]));
}

function changedKeys(previous: TraceSpan, current: TraceSpan): ReadonlySet<string> {
  const before = digestsOf(previous);
  const after = digestsOf(current);
  const keys = new Set([...before.keys(), ...after.keys()]);
  return new Set([...keys].filter((key) => before.get(key) !== after.get(key)));
}

function differs(previous: TraceSpan, current: TraceSpan): boolean {
  return (
    previous.attributes[ATTRIBUTE_TEMPLATES_DIGEST] !==
      current.attributes[ATTRIBUTE_TEMPLATES_DIGEST] || changedKeys(previous, current).size > 0
  );
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

export function changedPromptParts(
  previous: readonly TraceSpan[],
  current: readonly TraceSpan[],
): ReadonlyMap<string, ReadonlySet<string>> {
  const before = promptSpansByAgent(previous);
  const changed = new Map<string, ReadonlySet<string>>();
  for (const [name, span] of promptSpansByAgent(current)) {
    const earlier = before.get(name);
    if (earlier !== undefined) changed.set(name, changedKeys(earlier, span));
  }
  return changed;
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
