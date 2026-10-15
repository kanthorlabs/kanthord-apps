import { useEffect, useMemo, useRef } from "react";

import { listProjectExecutionPage } from "@/api/resources/scheduler";
import type { SchedulerExecutionRecord } from "@/api/types";
import { useCursorPages, type CursorPages } from "@/hooks/use-cursor-pages";

const DONE_PAGE_LIMIT = 20;

export interface DoneGroupState {
  readonly pages: CursorPages<SchedulerExecutionRecord>;
  readonly executions: readonly SchedulerExecutionRecord[];
}

export function useDoneGroup(projectId: string, refreshedAt: number | null): DoneGroupState {
  const pages = useCursorPages(
    (cursor) => listProjectExecutionPage(projectId, cursor, DONE_PAGE_LIMIT),
    [projectId],
  );
  const { hasPrevious, reload } = pages;
  const seenRefresh = useRef(refreshedAt);

  useEffect(() => {
    if (refreshedAt === seenRefresh.current) return;
    seenRefresh.current = refreshedAt;
    if (!hasPrevious) reload();
  }, [refreshedAt, hasPrevious, reload]);

  const executions = useMemo(
    () => pages.items.filter((execution) => execution.claim_state !== "running"),
    [pages.items],
  );

  return { pages, executions };
}
