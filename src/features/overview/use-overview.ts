import { useCallback, useMemo, useState } from "react";

import type { ApiError } from "@/api/errors";
import type { Project } from "@/api/types";
import { useScopedProject } from "@/hooks/use-scoped-project";
import {
  deriveAttention,
  detailTargetsOf,
  externalReadStateOf,
  groupItems,
  type AttentionDetails,
  type AttentionContext,
  type AttentionItem,
  type ProjectSnapshot,
} from "@/lib/attention";
import { unavailableComponentsOf } from "@/lib/liveness-alert";
import {
  attentionSummary,
  claimedNodeCount,
  coolingFactsOf,
  projectsWithoutSetup,
  type CoolingFact,
} from "@/lib/overview-summary";
import { tallyStates, type StateTally } from "@/lib/state-tally";

import type { ReadFault } from "./read-overview-snapshot";
import { useAttentionDetails } from "./use-attention-details";
import { useAttentionFocus, type AttentionFocus } from "./use-attention-focus";
import { useOverviewSetup } from "./use-overview-setup";
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
  readonly cooling: readonly CoolingFact[];
  readonly unavailable: readonly string[];
  readonly livenessFailure: string | null;
  readonly summary: string;
  readonly groups: ReturnType<typeof groupItems>;
  readonly faults: readonly ReadFault[];
  readonly allClear: boolean;
  readonly progress: readonly ProjectProgress[];
  readonly details: AttentionDetails;
  readonly retryDetail: (nodeId: string) => void;
  readonly setDialogOpen: (itemId: string, nodeId: string, open: boolean) => void;
  readonly focus: AttentionFocus;
  readonly updatedAt: number | null;
  readonly now: number;
  readonly refresh: () => void;
}

const NO_FAULTS: readonly ReadFault[] = [];
const NO_COMPONENTS: readonly string[] = [];

function schedulerPathOf(projectId: string | null): string {
  return projectId === null ? "/scheduler" : `/scheduler?project=${encodeURIComponent(projectId)}`;
}

export function useOverview(): OverviewState {
  const { projectId: requested, select } = useScopedProject();
  const [openDialogs, setOpenDialogs] = useState<ReadonlySet<string>>(new Set());
  const hold = openDialogs.size > 0;
  const snapshot = useOverviewSnapshot(hold, requested);
  const setup = useOverviewSetup(hold);

  const data = snapshot.data;
  const projects = useMemo(() => data?.projects ?? [], [data]);
  const projectId = projects.some((project) => project.id === requested) ? requested : null;

  const reads = useMemo(
    () => (data?.reads ?? []).filter((read) => projectId === null || read.project.id === projectId),
    [data, projectId],
  );

  const setupData = setup.data;

  const snapshots = useMemo<readonly ProjectSnapshot[]>(
    () =>
      reads.flatMap((read) =>
        read.mission === null || read.nodes === null
          ? []
          : [
              {
                project: read.project,
                missionVersion: read.mission.version,
                nodes: read.nodes,
                jobs: read.jobs,
                instances: read.instances,
                executions: read.executions,
                bindings:
                  setupData?.projects.find((entry) => entry.project.id === read.project.id)
                    ?.bindings ?? null,
              },
            ],
      ),
    [reads, setupData],
  );

  const targets = useMemo(() => detailTargetsOf(snapshots), [snapshots]);
  const { details, refresh: refreshDetail } = useAttentionDetails(targets, snapshot.updatedAt);
  const context = useMemo<AttentionContext>(
    () => ({
      now: snapshot.now,
      catalog: setupData?.catalog ?? null,
      credentials: setupData?.credentials ?? null,
      sessions: projectId === null ? (data?.sessions ?? null) : null,
    }),
    [snapshot.now, setupData, data, projectId],
  );
  const items = useMemo<readonly AttentionItem[]>(
    () => deriveAttention(snapshots, details, context),
    [snapshots, details, context],
  );
  const externalReads = useMemo(() => externalReadStateOf(targets, details), [targets, details]);

  const focus = useAttentionFocus(items, snapshot.updatedAt);
  const { markActed } = focus;

  const faults = useMemo<readonly ReadFault[]>(() => {
    const scoped = (data?.faults ?? NO_FAULTS).filter(
      (fault) => projectId === null || fault.projectId === projectId,
    );
    const outside = externalReads.failures.map(({ target, message }) => ({
      projectId: target.projectId,
      projectName: projects.find((project) => project.id === target.projectId)?.name ?? null,
      source: `external actions of ${target.node.content.name}`,
      message,
    }));
    const listFault =
      snapshot.error === null || data === null
        ? NO_FAULTS
        : [
            {
              projectId: null,
              projectName: null,
              source: "project list",
              message: snapshot.error.message,
            },
          ];
    const setupFaults = (setupData?.faults ?? NO_FAULTS).filter(
      (fault) => projectId === null || fault.projectId === null || fault.projectId === projectId,
    );
    const setupFailure =
      setup.error === null
        ? NO_FAULTS
        : [
            {
              projectId: null,
              projectName: null,
              source: "worker setup",
              message: setup.error.message,
            },
          ];
    return [...scoped, ...outside, ...listFault, ...setupFaults, ...setupFailure];
  }, [data, projectId, projects, externalReads, snapshot.error, setupData, setup.error]);

  const setDialogOpen = useCallback(
    (itemId: string, nodeId: string, open: boolean) => {
      setOpenDialogs((current) => {
        if (current.has(itemId) === open) return current;
        const next = new Set(current);
        if (open) next.add(itemId);
        else next.delete(itemId);
        return next;
      });
      if (open) refreshDetail(nodeId);
      else markActed(itemId);
    },
    [refreshDetail, markActed],
  );

  const cooling = useMemo(() => coolingFactsOf(snapshots), [snapshots]);
  const unavailable = useMemo(
    () =>
      setupData?.liveness == null ? NO_COMPONENTS : unavailableComponentsOf(setupData.liveness),
    [setupData],
  );
  const livenessFailure = setupData?.livenessFailure ?? null;

  const { refresh: refreshSnapshot } = snapshot;
  const { refresh: refreshSetup } = setup;
  const refresh = useCallback(() => {
    refreshSnapshot();
    refreshSetup();
  }, [refreshSnapshot, refreshSetup]);

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
    cooling,
    unavailable,
    livenessFailure,
    summary: attentionSummary(items),
    groups: groupItems(items),
    faults,
    allClear:
      faults.length === 0 &&
      externalReads.pending === 0 &&
      setupData !== null &&
      projectsWithoutSetup(snapshots, setupData.projects) === 0 &&
      livenessFailure === null &&
      items.length === 0,
    progress: snapshots.map((entry) => ({
      project: entry.project,
      tallies: tallyStates(entry.nodes),
    })),
    details,
    retryDetail: refreshDetail,
    setDialogOpen,
    focus,
    updatedAt: snapshot.updatedAt,
    now: snapshot.now,
    refresh,
  };
}
