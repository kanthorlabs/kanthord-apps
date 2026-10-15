import { useCallback, useMemo, useState } from "react";

import type { ApiError } from "@/api/errors";
import type { Project } from "@/api/types";
import { useScopedProject } from "@/hooks/use-scoped-project";
import {
  deriveAttention,
  detailTargetsOf,
  groupItems,
  type AttentionDetails,
  type AttentionItem,
  type ProjectSnapshot,
} from "@/lib/attention";
import { attentionSummary, claimedNodeCount } from "@/lib/overview-summary";
import { tallyStates, type StateTally } from "@/lib/state-tally";

import type { ReadFault } from "./read-overview-snapshot";
import { useAttentionDetails } from "./use-attention-details";
import { useOverviewSnapshot } from "./use-overview-snapshot";

export interface ProjectProgress {
  readonly project: Project;
  readonly tallies: readonly StateTally[];
}

export interface OverviewState {
  readonly status: "loading" | "ready" | "error";
  readonly error: ApiError | null;
  readonly projects: readonly Project[];
  readonly projectId: string | null;
  readonly selectProject: (projectId: string | null) => void;
  readonly showProjects: boolean;
  readonly running: number;
  readonly waiting: number;
  readonly schedulerPath: string;
  readonly summary: string;
  readonly groups: ReturnType<typeof groupItems>;
  readonly faults: readonly ReadFault[];
  readonly allClear: boolean;
  readonly progress: readonly ProjectProgress[];
  readonly details: AttentionDetails;
  readonly retryDetail: (nodeId: string) => void;
  readonly setDialogOpen: (nodeId: string, open: boolean) => void;
  readonly updatedAt: number | null;
  readonly now: number;
  readonly refresh: () => void;
}

const NO_FAULTS: readonly ReadFault[] = [];

function schedulerPathOf(projectId: string | null): string {
  return projectId === null ? "/scheduler" : `/scheduler?project=${encodeURIComponent(projectId)}`;
}

export function useOverview(): OverviewState {
  const { projectId: requested, select } = useScopedProject();
  const [openDialogs, setOpenDialogs] = useState<ReadonlySet<string>>(new Set());
  const snapshot = useOverviewSnapshot(openDialogs.size > 0);

  const data = snapshot.data;
  const projects = useMemo(() => data?.projects ?? [], [data]);
  const projectId = projects.some((project) => project.id === requested) ? requested : null;

  const reads = useMemo(
    () => (data?.reads ?? []).filter((read) => projectId === null || read.project.id === projectId),
    [data, projectId],
  );

  const snapshots = useMemo<readonly ProjectSnapshot[]>(
    () =>
      reads.flatMap((read) =>
        read.mission === null || read.nodes === null
          ? []
          : [{ project: read.project, missionVersion: read.mission.version, nodes: read.nodes }],
      ),
    [reads],
  );

  const items = useMemo<readonly AttentionItem[]>(() => deriveAttention(snapshots), [snapshots]);
  const targets = useMemo(() => detailTargetsOf(items), [items]);
  const { details, refresh: refreshDetail } = useAttentionDetails(targets);

  const faults = useMemo<readonly ReadFault[]>(() => {
    const scoped = (data?.faults ?? NO_FAULTS).filter(
      (fault) => projectId === null || fault.projectId === projectId,
    );
    if (snapshot.error === null || data === null) return scoped;
    return [
      ...scoped,
      {
        projectId: null,
        projectName: null,
        source: "project list",
        message: snapshot.error.message,
      },
    ];
  }, [data, projectId, snapshot.error]);

  const setDialogOpen = useCallback(
    (nodeId: string, open: boolean) => {
      setOpenDialogs((current) => {
        if (current.has(nodeId) === open) return current;
        const next = new Set(current);
        if (open) next.add(nodeId);
        else next.delete(nodeId);
        return next;
      });
      if (open) refreshDetail(nodeId);
    },
    [refreshDetail],
  );

  const status = data !== null ? "ready" : snapshot.loading ? "loading" : "error";

  return {
    status,
    error: snapshot.error,
    projects,
    projectId,
    selectProject: select,
    showProjects: projectId === null,
    running: snapshots.reduce((total, entry) => total + claimedNodeCount(entry.nodes), 0),
    waiting: reads.reduce((total, read) => total + (read.jobs?.length ?? 0), 0),
    schedulerPath: schedulerPathOf(projectId),
    summary: attentionSummary(items),
    groups: groupItems(items),
    faults,
    allClear: faults.length === 0 && items.length === 0,
    progress: snapshots.map((entry) => ({
      project: entry.project,
      tallies: tallyStates(entry.nodes),
    })),
    details,
    retryDetail: refreshDetail,
    setDialogOpen,
    updatedAt: snapshot.updatedAt,
    now: snapshot.now,
    refresh: snapshot.refresh,
  };
}
