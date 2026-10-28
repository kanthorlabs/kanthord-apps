import { useEffect, useMemo, useRef } from "react";

import { listProjectExecutionPage } from "@/api/resources/scheduler";
import type { SchedulerExecutionRecord } from "@/api/types";
import { type CursorPages, useCursorPages } from "@/hooks/use-cursor-pages";
import { nodePath } from "@/lib/node-path";

import type { DoneSource, RefreshSignal } from "./use-scheduler-board";

const DONE_PAGE_LIMIT = 20;

export interface DoneView {
  readonly execution: SchedulerExecutionRecord;
  readonly nodeName: string;
  readonly projectName: string | null;
  readonly href: string;
}

export interface DoneGroupState {
  readonly pages: CursorPages<SchedulerExecutionRecord>;
  readonly views: readonly DoneView[];
}

export function useDoneGroup(
  { project, nodeNames }: DoneSource,
  showProject: boolean,
  signal: RefreshSignal,
): DoneGroupState {
  const projectId = project.id;
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

  const views = useMemo(
    () =>
      pages.items
        .filter((execution) => execution.claim_state !== "running")
        .map((execution) => ({
          execution,
          nodeName: nodeNames.get(execution.node_id) ?? execution.node_id,
          projectName: showProject ? project.name : null,
          href: nodePath(projectId, execution.node_id),
        })),
    [pages.items, nodeNames, showProject, project.name, projectId],
  );

  return { pages, views };
}
