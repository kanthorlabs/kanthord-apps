import { useEffect, useMemo, useRef } from "react";

import { listProjectExecutionPage } from "@/api/resources/scheduler";
import type { SchedulerExecutionRecord } from "@/api/types";
import { useCursorPages, type CursorPages } from "@/hooks/use-cursor-pages";

import type { RefreshSignal } from "./use-scheduler-board";

const DONE_PAGE_LIMIT = 20;

export interface DoneGroupState {
  readonly pages: CursorPages<SchedulerExecutionRecord>;
  readonly executions: readonly SchedulerExecutionRecord[];
}

export function useDoneGroup(projectId: string, signal: RefreshSignal): DoneGroupState {
  const pages = useCursorPages(
    (cursor) => listProjectExecutionPage(projectId, cursor, DONE_PAGE_LIMIT),
    [projectId],
  );
  const { hasPrevious, pending, reload } = pages;
  const seen = useRef(signal);
  const manualAsked = useRef(false);

  useEffect(() => {
    const previous = seen.current;
    seen.current = signal;
    if (signal.manual !== previous.manual) manualAsked.current = true;
    if (signal.at === previous.at) return;
    const manual = manualAsked.current;
    manualAsked.current = false;
    if (pending) return;
    if (manual || !hasPrevious) reload();
  }, [signal, hasPrevious, pending, reload]);

  const executions = useMemo(
    () => pages.items.filter((execution) => execution.claim_state !== "running"),
    [pages.items],
  );

  return { pages, executions };
}
