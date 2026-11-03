import { useMemo } from "react";

import type { ApiError } from "@/api/errors";
import { listSessionEntryPage } from "@/api/resources/tracking";
import { resolveAgentPrompt } from "@/api/resources/workers";
import type { PromptPart, PromptResolveAnswer, TraceSessionEntry, TraceSpan } from "@/api/types";
import { asApiError, useResource } from "@/hooks/use-resource";
import {
  pinnedContextEntryIds,
  promptPartKey,
  taskTemplates,
  workPromptEntryIds,
} from "@/lib/agent-prompt-parts";
import { sessionSpansOf } from "@/lib/conversation-spans";
import { entryView } from "@/lib/session-entries";

import { ENTRY_PAGE_LIMIT, ENTRY_PAGES_MAX } from "./use-session-entries";
import type { PromptDiffBase } from "./use-node-traces";
import type { TraceSelection } from "./use-trace-selection";

export interface PromptText {
  readonly entryId: string | null;
  readonly length: number;
  readonly text: string;
}

export interface AgentPromptPart extends PromptPart {
  readonly key: string;
  readonly changed: boolean;
}

export interface AgentPrompt {
  readonly name: string;
  readonly parts: readonly AgentPromptPart[];
  readonly systemPrompt: PromptText | null;
  readonly engineVersion: string | null;
  readonly error: ApiError | null;
  readonly diffExecutionId: string | null;
}

export interface TaskPrompt {
  readonly taskId: string;
  readonly template: string | null;
  readonly prompt: PromptText & { readonly entryId: string };
}

export interface AgentPromptState {
  readonly recorded: boolean;
  readonly resolvable: boolean;
  readonly loading: boolean;
  readonly error: ApiError | null;
  readonly retry: () => void;
  readonly agents: readonly AgentPrompt[];
  readonly tasks: readonly TaskPrompt[];
  readonly openInConversation: (entryId: string) => void;
}

interface AgentRead {
  readonly name: string;
  readonly answer: PromptResolveAnswer | null;
  readonly error: ApiError | null;
}

const OPERATION_PROMPT = "agent.prompt";
const OPERATION_TASK = "worker.task";
const ATTRIBUTE_AGENT_NAME = "kanthord.agent.name";
const ATTRIBUTE_TASK_ID = "kanthord.task.id";
const NO_ENTRIES: readonly TraceSessionEntry[] = [];
const NO_READS: readonly AgentRead[] = [];
const NO_KEYS: ReadonlySet<string> = new Set();

function nameOf(span: TraceSpan): string | null {
  const name = span.attributes[ATTRIBUTE_AGENT_NAME];
  return typeof name === "string" ? name : null;
}

function startOf(span: TraceSpan): number {
  return span.start_time ?? Number.POSITIVE_INFINITY;
}

function promptAgentNames(spans: readonly TraceSpan[]): readonly string[] {
  const names: string[] = [];
  const ordered = spans
    .filter((span) => span.operation === OPERATION_PROMPT)
    .sort((a, b) => startOf(a) - startOf(b));
  for (const span of ordered) {
    const name = nameOf(span);
    if (name !== null && !names.includes(name)) names.push(name);
  }
  return names;
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

async function readAgents(
  executionId: string,
  names: readonly string[],
): Promise<readonly AgentRead[]> {
  return Promise.all(
    names.map((name) =>
      resolveAgentPrompt(executionId, name).then(
        (answer) => ({ name, answer, error: null }),
        (cause: unknown) => ({ name, answer: null, error: asApiError(cause) }),
      ),
    ),
  );
}

function workPromptOf(
  entries: readonly TraceSessionEntry[],
  entryId: string,
): (PromptText & { readonly entryId: string }) | null {
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

function agentOf(
  read: AgentRead,
  pinnedEntryId: string | null,
  diffBase: PromptDiffBase | null,
): AgentPrompt {
  const changed = diffBase?.changed.get(read.name) ?? NO_KEYS;
  const final = read.answer?.final ?? null;
  return {
    name: read.name,
    parts: (read.answer?.parts ?? []).map((part) => {
      const key = promptPartKey(part);
      return { ...part, key, changed: changed.has(key) };
    }),
    systemPrompt:
      final === null ? null : { entryId: pinnedEntryId, length: final.length, text: final },
    engineVersion: read.answer?.engine_version ?? null,
    error: read.error,
    diffExecutionId: changed.size === 0 ? null : (diffBase?.executionId ?? null),
  };
}

export function useAgentPrompt(
  traceId: string,
  executionId: string | null,
  spans: readonly TraceSpan[],
  selection: TraceSelection,
  diffBase: PromptDiffBase | null,
): AgentPromptState {
  const session = sessionSpansOf(spans)[0] ?? null;
  const sessionId = session?.span_id ?? null;
  const names = promptAgentNames(spans);
  const recorded = names.length > 0;
  const readable = recorded && sessionId !== null;
  const entriesResource = useResource(
    async () => (readable ? readEntries(traceId, sessionId) : NO_ENTRIES),
    [traceId, sessionId, readable],
  );
  const resolvable = recorded && executionId !== null;
  const agentsResource = useResource(
    async () => (resolvable ? readAgents(executionId, names) : NO_READS),
    [executionId, names, resolvable],
  );
  const entries = entriesResource.data ?? NO_ENTRIES;
  const reads = agentsResource.data ?? NO_READS;
  const sessionAgent = session === null ? null : nameOf(session);

  const derived = useMemo(() => {
    const pinnedEntryId = pinnedContextEntryIds(entries)[0] ?? null;
    return {
      agents: reads.map((read) =>
        agentOf(read, read.name === sessionAgent ? pinnedEntryId : null, diffBase),
      ),
      tasks: tasksOf(spans, entries),
    };
  }, [spans, entries, reads, sessionAgent, diffBase]);

  return {
    recorded,
    resolvable,
    loading: (readable && entriesResource.loading) || (resolvable && agentsResource.loading),
    error: entriesResource.error ?? agentsResource.error,
    retry: () => {
      entriesResource.reload();
      agentsResource.reload();
    },
    agents: derived.agents,
    tasks: derived.tasks,
    openInConversation: (entryId) => {
      if (sessionId !== null) selection.openInConversation(sessionId, entryId);
    },
  };
}
