import {
  createContext,
  createElement,
  type ReactNode,
  useContext,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from "react";

import { listNodeAssessments, listNodeEvidence } from "@/api/resources/mission";
import { listTraceSpans } from "@/api/resources/tracking";
import { readWorkbenchEvents } from "@/api/resources/workbench";
import type {
  MissionAssessment,
  SchedulerExecutionRecord,
  TraceListQuery,
  WorkbenchPendingApproval,
} from "@/api/types";
import { asApiError, type Resource, useResource } from "@/hooks/use-resource";
import {
  type AttentionDetails,
  type AttentionItem,
  type DependencyItem,
  detailKeyOf,
  detailOf,
  type DetailRead,
} from "@/lib/attention";
import type { BoardReads, DiscardReason, EvidenceReads, TraceCause } from "@/lib/board-evidence";

import { useLastTrace } from "./use-last-trace-cause";

export type BoardReadId = keyof BoardReads;

export interface BoardReadsState extends BoardReads {
  readonly retry: Readonly<Record<BoardReadId, () => void>>;
}

export interface BoardReadsValue extends BoardReadsState, EvidenceReads {}

interface ReadSlot<T> {
  readonly read: DetailRead<T> | null;
  readonly retry: () => void;
}

const NO_EXECUTIONS: readonly SchedulerExecutionRecord[] = [];

const PENDING_READS: BoardReadsValue = {
  session: null,
  discard: null,
  evidence: null,
  transition: null,
  cause: null,
  executions: NO_EXECUTIONS,
  retry: {
    session: () => undefined,
    discard: () => undefined,
    evidence: () => undefined,
    transition: () => undefined,
    cause: () => undefined,
  },
};

interface ReadsStore {
  readonly get: () => BoardReadsValue;
  readonly set: (value: BoardReadsValue) => void;
  readonly subscribe: (listener: () => void) => () => void;
}

function createReadsStore(): ReadsStore {
  let current = PENDING_READS;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set: (value) => {
      current = value;
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const BoardReadsContext = createContext<ReadsStore>(createReadsStore());

async function settle<T>(read: Promise<T>): Promise<DetailRead<T>> {
  try {
    return { status: "ready", data: await read };
  } catch (cause: unknown) {
    return { status: "failed", message: asApiError(cause).message };
  }
}

function useSettled<T>(key: string, read: (() => Promise<T>) | null, none: T): ReadSlot<T> {
  const resource = useResource(() => settle(read === null ? Promise.resolve(none) : read()), [key]);
  return {
    read: read === null ? { status: "ready", data: none } : resource.data,
    retry: resource.reload,
  };
}

function readKeyOf(item: AttentionItem): string {
  if (item.kind === "tool_approval") return `${item.id}:${item.toolCallId}`;
  if (item.group === "fixes") return item.id;
  const execution = item.kind === "paused" ? item.pause?.execution?.execution_id : undefined;
  return `${item.id}:${detailKeyOf(item.node)}:${execution ?? ""}`;
}

function newestHumanReasonOf(assessments: readonly MissionAssessment[]): string | null {
  const human = assessments.filter((assessment) => assessment.actor.kind === "human");
  const newest = human.reduce<MissionAssessment | null>(
    (latest, assessment) =>
      latest === null || assessment.created_at > latest.created_at ? assessment : latest,
    null,
  );
  return newest?.rationale ?? null;
}

function discardReasonsOf(item: DependencyItem): () => Promise<readonly DiscardReason[]> {
  return () =>
    Promise.all(
      item.discarded.map(async ({ id }): Promise<DiscardReason> => {
        const node = item.nodes.find((candidate) => candidate.id === id);
        if (node === undefined) return { id, reason: null };
        return { id, reason: newestHumanReasonOf(await listNodeAssessments(id, node.attempt)) };
      }),
    );
}

function sessionReadOf(
  item: AttentionItem,
): (() => Promise<WorkbenchPendingApproval | null>) | null {
  if (item.kind !== "tool_approval") return null;
  return async () =>
    (await readWorkbenchEvents(item.sessionId, null, null)).snapshot.pending_approval;
}

function traceQueryOf(item: AttentionItem): TraceListQuery | null {
  if (item.kind === "blocked") return { node_id: item.node.id };
  const execution = item.kind === "paused" ? item.pause?.execution : null;
  return execution === null || execution === undefined
    ? null
    : { execution_id: execution.execution_id };
}

function causeReadOf(
  resource: Resource<TraceCause | null>,
  query: TraceListQuery | null,
): DetailRead<TraceCause | null> | null {
  if (query === null) return { status: "ready", data: null };
  if (resource.error !== null) return { status: "failed", message: resource.error.message };
  return resource.loading ? null : { status: "ready", data: resource.data };
}

export function useBoardReads(item: AttentionItem): BoardReadsState {
  const key = readKeyOf(item);
  const execution = item.kind === "paused" ? (item.pause?.execution ?? null) : null;
  const query = traceQueryOf(item);
  const session = useSettled(key, sessionReadOf(item), null);
  const discard = useSettled(
    key,
    item.kind === "dependency_discarded" ? discardReasonsOf(item) : null,
    [],
  );
  const evidence = useSettled(
    key,
    item.kind === "blocked" ? () => listNodeEvidence(item.node.id, item.node.attempt) : null,
    [],
  );
  const transition = useSettled(
    key,
    execution === null ? null : () => listTraceSpans(execution.trace_id),
    [],
  );
  const trace = useLastTrace(query);

  return {
    session: session.read,
    discard: discard.read,
    evidence: evidence.read,
    transition: transition.read,
    cause: causeReadOf(trace, query),
    retry: {
      session: session.retry,
      discard: discard.retry,
      evidence: evidence.retry,
      transition: transition.retry,
      cause: trace.reload,
    },
  };
}

function executionsOf(
  item: AttentionItem,
  details: AttentionDetails,
): readonly SchedulerExecutionRecord[] {
  if (item.kind !== "paused") return NO_EXECUTIONS;
  const detail = detailOf(details, item.node);
  return detail?.kind === "paused" && detail.executions.status === "ready"
    ? detail.executions.data
    : NO_EXECUTIONS;
}

interface BoardReadsProviderProps {
  readonly item: AttentionItem | null;
  readonly details: AttentionDetails;
  readonly children: ReactNode;
}

interface ReadsScopeProps {
  readonly store: ReadsStore;
  readonly item: AttentionItem;
  readonly details: AttentionDetails;
}

function ReadsScope({ store, item, details }: ReadsScopeProps) {
  const reads = useBoardReads(item);
  const value: BoardReadsValue = { ...reads, executions: executionsOf(item, details) };
  useLayoutEffect(() => {
    store.set(value);
  });
  useLayoutEffect(
    () => () => {
      store.set(PENDING_READS);
    },
    [store],
  );
  return null;
}

export function BoardReadsProvider({ item, details, children }: BoardReadsProviderProps) {
  const [store] = useState(createReadsStore);
  return createElement(
    BoardReadsContext.Provider,
    { value: store },
    children,
    item === null
      ? null
      : createElement(ReadsScope, { key: readKeyOf(item), store, item, details }),
  );
}

export function useBoardReadsContext(): BoardReadsValue {
  const store = useContext(BoardReadsContext);
  return useSyncExternalStore(store.subscribe, store.get);
}
