import { listTracePage } from "@/api/resources/tracking";
import type { EffectiveCause } from "@/api/types";
import { useResource } from "@/hooks/use-resource";

async function readCause(executionId: string | null): Promise<EffectiveCause | null> {
  if (executionId === null) return null;
  const page = await listTracePage({ execution_id: executionId }, null, 1);
  return page.items[0]?.cause ?? null;
}

export function useLastTraceCause(executionId: string | null): EffectiveCause | null {
  return useResource(() => readCause(executionId), [executionId]).data;
}
