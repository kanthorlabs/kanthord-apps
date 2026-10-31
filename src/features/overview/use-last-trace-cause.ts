import { listTracePage } from "@/api/resources/tracking";
import type { EffectiveCause, TraceListQuery } from "@/api/types";
import { type Resource, useResource } from "@/hooks/use-resource";
import type { TraceCause } from "@/lib/board-evidence";

async function readTraceCause(query: TraceListQuery | null): Promise<TraceCause | null> {
  if (query === null) return null;
  const page = await listTracePage(query, null, 1);
  const [newest] = page.items;
  return newest === undefined ? null : { traceId: newest.trace_id, cause: newest.cause };
}

export function useLastTrace(query: TraceListQuery | null): Resource<TraceCause | null> {
  return useResource(() => readTraceCause(query), [query]);
}

export function useLastTraceCause(executionId: string | null): EffectiveCause | null {
  const query = executionId === null ? null : { execution_id: executionId };
  return useLastTrace(query).data?.cause ?? null;
}
