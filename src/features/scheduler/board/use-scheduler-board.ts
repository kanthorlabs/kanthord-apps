import { useCallback, useMemo, useState } from "react";

import type { ApiError } from "@/api/errors";
import { listWorkerCatalog } from "@/api/resources/workers";
import type {
  MissionNodeRecord,
  NodeState,
  Project,
  SchedulerExecutionRecord,
  SchedulerJob,
} from "@/api/types";
import { usePolledResource } from "@/hooks/use-polled-resource";
import { useScopedProject } from "@/hooks/use-scoped-project";
import { uncoveredStates } from "@/lib/claim-takers";
import { nodePath } from "@/lib/node-path";
import { ulidTime } from "@/lib/ulid";

import { readSchedulerBoard, type ProjectBoard } from "./read-scheduler-board";

const BOARD_INTERVAL_MS = 15_000;
const CATALOG_INTERVAL_MS = 60_000;

export type ClaimKind = "Steps" | "Evaluation";

export interface RunningView {
  readonly execution: SchedulerExecutionRecord;
  readonly nodeName: string;
  readonly kind: ClaimKind | null;
  readonly projectName: string | null;
  readonly href: string;
}

export interface JobView {
  readonly job: SchedulerJob;
  readonly position: number;
  readonly nodeName: string;
  readonly state: NodeState | null;
  readonly claim: ClaimKind | null;
  readonly queuedAt: number | null;
  readonly noTaker: boolean;
  readonly href: string;
}

export interface QueueGroup {
  readonly project: Project;
  readonly jobs: readonly JobView[];
}

export interface DoneSource {
  readonly project: Project;
  readonly nodeNames: ReadonlyMap<string, string>;
}

export interface RefreshSignal {
  readonly at: number | null;
  readonly manual: number;
}

export interface SchedulerBoardState {
  readonly status: "loading" | "ready" | "error";
  readonly error: ApiError | null;
  readonly catalogError: ApiError | null;
  readonly projects: readonly Project[];
  readonly projectId: string | null;
  readonly selectProject: (projectId: string | null) => void;
  readonly showProjects: boolean;
  readonly pausedProjects: readonly Project[];
  readonly running: readonly RunningView[];
  readonly queue: readonly QueueGroup[];
  readonly done: readonly DoneSource[];
  readonly updatedAt: number | null;
  readonly refreshSignal: RefreshSignal;
  readonly now: number;
  readonly refresh: () => void;
}

function nodeNamesOf(nodes: readonly MissionNodeRecord[]): ReadonlyMap<string, string> {
  return new Map(nodes.map((node) => [node.id, node.content.name]));
}

function nodeStatesOf(nodes: readonly MissionNodeRecord[]): ReadonlyMap<string, NodeState> {
  return new Map(nodes.map((node) => [node.id, node.state]));
}

function claimKindOfState(state: NodeState | null): ClaimKind | null {
  if (state === "Available") return "Steps";
  if (state === "Waiting" || state === "External.Requested") return "Evaluation";
  return null;
}

function runningKindOf(state: NodeState | undefined): ClaimKind | null {
  if (state === "Executing") return "Steps";
  if (state === "Evaluating") return "Evaluation";
  return null;
}

function runningViewsOf(board: ProjectBoard, showProject: boolean): readonly RunningView[] {
  const names = nodeNamesOf(board.nodes);
  const states = nodeStatesOf(board.nodes);
  return board.executions
    .filter((execution) => execution.claim_state === "running")
    .map((execution) => ({
      execution,
      nodeName: names.get(execution.node_id) ?? execution.node_id,
      kind: runningKindOf(states.get(execution.node_id)),
      projectName: showProject ? board.project.name : null,
      href: nodePath(board.project.id, execution.node_id),
    }));
}

function queueGroupOf(board: ProjectBoard, uncovered: ReadonlySet<string> | null): QueueGroup {
  const names = nodeNamesOf(board.nodes);
  const states = nodeStatesOf(board.nodes);
  return {
    project: board.project,
    jobs: board.jobs.map((job, index) => {
      const state = states.get(job.node_id) ?? null;
      return {
        job,
        position: index + 1,
        nodeName: names.get(job.node_id) ?? job.node_id,
        state,
        claim: claimKindOfState(state),
        queuedAt: ulidTime(job.job_id),
        noTaker: uncovered !== null && state !== null && uncovered.has(state),
        href: nodePath(board.project.id, job.node_id),
      };
    }),
  };
}

export function useSchedulerBoard(): SchedulerBoardState {
  const { projectId: requested, select } = useScopedProject();
  const board = usePolledResource(readSchedulerBoard, [], { intervalMs: BOARD_INTERVAL_MS });
  const catalog = usePolledResource(listWorkerCatalog, [], { intervalMs: CATALOG_INTERVAL_MS });

  const snapshot = board.data;
  const projects = useMemo(() => snapshot?.projects ?? [], [snapshot]);
  const projectId = projects.some((project) => project.id === requested) ? requested : null;
  const boards = useMemo(
    () =>
      (snapshot?.boards ?? []).filter(
        (entry) => projectId === null || entry.project.id === projectId,
      ),
    [snapshot, projectId],
  );
  const catalogData = catalog.data;
  const [manualRefreshes, setManualRefreshes] = useState(0);
  const { updatedAt, refresh: refreshBoard } = board;
  const { refresh: refreshCatalog } = catalog;
  const refreshSignal = useMemo(
    () => ({ at: updatedAt, manual: manualRefreshes }),
    [updatedAt, manualRefreshes],
  );
  const refresh = useCallback(() => {
    setManualRefreshes((count) => count + 1);
    refreshBoard();
    refreshCatalog();
  }, [refreshBoard, refreshCatalog]);

  const running = useMemo(
    () =>
      boards
        .flatMap((entry) => runningViewsOf(entry, projectId === null))
        .sort((left, right) => left.execution.expired_at - right.execution.expired_at),
    [boards, projectId],
  );

  const queue = useMemo(
    () =>
      boards
        .map((entry) =>
          queueGroupOf(
            entry,
            catalogData === null
              ? null
              : uncoveredStates(entry.jobs, entry.nodes, entry.instances, catalogData),
          ),
        )
        .filter((group) => group.jobs.length > 0),
    [boards, catalogData],
  );

  const done = useMemo(
    () => boards.map((entry) => ({ project: entry.project, nodeNames: nodeNamesOf(entry.nodes) })),
    [boards],
  );

  const pausedProjects = useMemo(
    () => boards.map((entry) => entry.project).filter((project) => project.paused_at !== null),
    [boards],
  );

  const status = snapshot !== null ? "ready" : board.loading ? "loading" : "error";

  return {
    status,
    error: board.error,
    catalogError: catalogData === null ? catalog.error : null,
    projects,
    projectId,
    selectProject: select,
    showProjects: projectId === null,
    pausedProjects,
    running,
    queue,
    done,
    updatedAt,
    refreshSignal,
    now: board.now,
    refresh,
  };
}
