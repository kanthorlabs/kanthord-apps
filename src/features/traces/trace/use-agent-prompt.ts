import { useMemo } from "react";

import type { ApiError } from "@/api/errors";
import { listSessionEntryPage } from "@/api/resources/tracking";
import type { TraceSessionEntry, TraceSpan } from "@/api/types";
import { useResource } from "@/hooks/use-resource";
import {
  pinnedContextEntryIds,
  type PromptPartRef,
  promptPartsOf,
  taskTemplates,
  workPromptEntryIds,
} from "@/lib/agent-prompt-parts";
import { sessionSpansOf } from "@/lib/conversation-spans";
import { entryView } from "@/lib/session-entries";

import { ENTRY_PAGE_LIMIT, ENTRY_PAGES_MAX } from "./use-session-entries";
import type { TraceSelection } from "./use-trace-selection";

export interface PromptText {
  readonly entryId: string;
  readonly length: number;
  readonly text: string;
}

export interface AgentPrompt {
  readonly name: string;
  readonly parts: readonly PromptPartRef[];
  readonly systemPrompt: PromptText | null;
}

export interface TaskPrompt {
  readonly taskId: string;
  readonly template: string | null;
  readonly prompt: PromptText;
}

export interface AgentPromptState {
  readonly recorded: boolean;
  readonly loading: boolean;
  readonly error: ApiError | null;
  readonly retry: () => void;
  readonly agents: readonly AgentPrompt[];
  readonly tasks: readonly TaskPrompt[];
  readonly openInConversation: (entryId: string) => void;
}

const OPERATION_PROMPT = "agent.prompt";
const OPERATION_TASK = "worker.task";
const ATTRIBUTE_AGENT_NAME = "kanthord.agent.name";
const ATTRIBUTE_TASK_ID = "kanthord.task.id";
const SECTION_SEPARATOR = "\n\n";
const NO_ENTRIES: readonly TraceSessionEntry[] = [];

function nameOf(span: TraceSpan): string | null {
  const name = span.attributes[ATTRIBUTE_AGENT_NAME];
  return typeof name === "string" ? name : null;
}

function startOf(span: TraceSpan): number {
  return span.start_time ?? Number.POSITIVE_INFINITY;
}

function promptSpansByAgent(spans: readonly TraceSpan[]): ReadonlyMap<string, TraceSpan> {
  const byName = new Map<string, TraceSpan>();
  const ordered = spans
    .filter((span) => span.operation === OPERATION_PROMPT)
    .sort((a, b) => startOf(a) - startOf(b));
  for (const span of ordered) {
    const name = nameOf(span);
    if (name !== null && !byName.has(name)) byName.set(name, span);
  }
  return byName;
}

async function readEntries(
  traceId: string,
  sessionId: string,
): Promise<readonly TraceSessionEntry[]> {
  const entries: TraceSessionEntry[] = [];
  let cursor: string | null = null;
  for (let pages = 0; pages < ENTRY_PAGES_MAX; pages += 1) {
    const page = await listSessionEntryPage(traceId, sessionId, cursor, ENTRY_PAGE_LIMIT);
    entries.push(...page.items);
    if (page.next_cursor === null) break;
    cursor = page.next_cursor;
  }
  return entries;
}

function systemPromptOf(entries: readonly TraceSessionEntry[]): PromptText | null {
  const pinned = new Set(pinnedContextEntryIds(entries));
  for (const entry of entries) {
    const view = entryView(entry);
    if (!pinned.has(entry.entry_id) || view.kind !== "system") continue;
    const text = view.sections.map((section) => section.text).join(SECTION_SEPARATOR);
    return { entryId: entry.entry_id, length: text.length, text };
  }
  return null;
}

function workPromptOf(entries: readonly TraceSessionEntry[], entryId: string): PromptText | null {
  const entry = entries.find((candidate) => candidate.entry_id === entryId);
  const view = entry === undefined ? null : entryView(entry);
  return view?.kind === "user" ? { entryId, length: view.text.length, text: view.text } : null;
}

function taskIdOf(task: TraceSpan): string {
  const id = task.attributes[ATTRIBUTE_TASK_ID];
  return typeof id === "string" ? id : task.span_id;
}

function tasksOf(
  spans: readonly TraceSpan[],
  entries: readonly TraceSessionEntry[],
): readonly TaskPrompt[] {
  const templates = taskTemplates(spans);
  const entryIds = workPromptEntryIds(spans, entries);
  return spans
    .filter((span) => span.operation === OPERATION_TASK)
    .flatMap((task) => {
      const entryId = entryIds.get(task.span_id);
      const prompt = entryId === undefined ? null : workPromptOf(entries, entryId);
      if (prompt === null) return [];
      return [{ taskId: taskIdOf(task), template: templates.get(task.span_id) ?? null, prompt }];
    });
}

function agentsOf(
  spans: readonly TraceSpan[],
  sessionAgent: string | null,
  systemPrompt: PromptText | null,
): readonly AgentPrompt[] {
  return [...promptSpansByAgent(spans)].map(([name, span]) => ({
    name,
    parts: promptPartsOf(span),
    systemPrompt: name === sessionAgent ? systemPrompt : null,
  }));
}

export function useAgentPrompt(
  traceId: string,
  spans: readonly TraceSpan[],
  selection: TraceSelection,
): AgentPromptState {
  const session = sessionSpansOf(spans)[0] ?? null;
  const sessionId = session?.span_id ?? null;
  const recorded = promptSpansByAgent(spans).size > 0;
  const readable = recorded && sessionId !== null;
  const resource = useResource(
    async () => (readable ? readEntries(traceId, sessionId) : NO_ENTRIES),
    [traceId, sessionId, readable],
  );
  const entries = resource.data ?? NO_ENTRIES;
  const sessionAgent = session === null ? null : nameOf(session);

  const derived = useMemo(() => {
    const systemPrompt = systemPromptOf(entries);
    return {
      agents: agentsOf(spans, sessionAgent, systemPrompt),
      tasks: tasksOf(spans, entries),
    };
  }, [spans, entries, sessionAgent]);

  return {
    recorded,
    loading: readable && resource.loading,
    error: resource.error,
    retry: resource.reload,
    agents: derived.agents,
    tasks: derived.tasks,
    openInConversation: (entryId) => {
      if (sessionId !== null) selection.openInConversation(sessionId, entryId);
    },
  };
}
