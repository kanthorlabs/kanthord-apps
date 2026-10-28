import { useCallback } from "react";

import { type ProjectPause, useProjectPause } from "@/hooks/use-project-pause";
import type { ProjectPausedItem } from "@/lib/fix-attention";

interface FixContext {
  readonly reload: () => void;
  readonly markActed: (itemId: string) => void;
}

export function useFixActs(
  item: ProjectPausedItem,
  { reload, markActed }: FixContext,
): ProjectPause {
  const itemId = item.id;
  const resumed = useCallback(() => {
    markActed(itemId);
    reload();
  }, [markActed, itemId, reload]);
  return useProjectPause(item.project, resumed);
}
