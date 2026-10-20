import { listMissionNodes, readMission } from "@/api/resources/mission";
import { listProjects } from "@/api/resources/projects";
import { listProjectExecutionPage, listQueueJobs } from "@/api/resources/scheduler";
import { listWorkbenchSessions } from "@/api/resources/workbench";
import { listWorkerRegistrations } from "@/api/resources/workers";
import type {
  Mission,
  MissionNodeRecord,
  Project,
  SchedulerExecutionRecord,
  SchedulerJob,
  WorkbenchSessionListItem,
  WorkerRegistrationRecord,
} from "@/api/types";
import { asApiError } from "@/hooks/use-resource";

const EXECUTION_PAGE_LIMIT = 100;

export interface ProjectRead {
  readonly project: Project;
  readonly mission: Mission | null;
  readonly nodes: readonly MissionNodeRecord[] | null;
  readonly jobs: readonly SchedulerJob[] | null;
  readonly registrations: readonly WorkerRegistrationRecord[] | null;
  readonly executions: readonly SchedulerExecutionRecord[] | null;
}

export interface ReadFault {
  readonly projectId: string | null;
  readonly projectName: string | null;
  readonly source: string;
  readonly message: string;
}

export interface OverviewSnapshot {
  readonly projects: readonly Project[];
  readonly reads: readonly ProjectRead[];
  readonly sessions: readonly WorkbenchSessionListItem[] | null;
  readonly faults: readonly ReadFault[];
}

export interface Settled<T> {
  readonly data: T | null;
  readonly fault: ReadFault | null;
}

export async function settle<T>(
  project: Project | null,
  source: string,
  read: () => Promise<T>,
  kept: T | null,
): Promise<Settled<T>> {
  try {
    return { data: await read(), fault: null };
  } catch (cause: unknown) {
    return {
      data: kept,
      fault: {
        projectId: project?.id ?? null,
        projectName: project?.name ?? null,
        source,
        message: asApiError(cause).message,
      },
    };
  }
}

async function readNodes(
  project: Project,
  mission: Mission | null,
  previous: ProjectRead | null,
): Promise<Settled<readonly MissionNodeRecord[]>> {
  if (mission === null) return { data: previous?.nodes ?? null, fault: null };
  return settle(project, "node list", () => listMissionNodes(mission.id), previous?.nodes ?? null);
}

async function readProject(
  project: Project,
  previous: ProjectRead | null,
): Promise<{ readonly read: ProjectRead; readonly faults: readonly ReadFault[] }> {
  const mission = await settle(
    project,
    "mission",
    () => readMission(project.id),
    previous?.mission ?? null,
  );
  const [nodes, jobs, registrations, executions] = await Promise.all([
    readNodes(project, mission.data, previous),
    settle(project, "queue", () => listQueueJobs(project.id), previous?.jobs ?? null),
    settle(
      project,
      "worker registrations",
      () => listWorkerRegistrations(project.id),
      previous?.registrations ?? null,
    ),
    settle(
      project,
      "executions",
      async () => (await listProjectExecutionPage(project.id, null, EXECUTION_PAGE_LIMIT)).items,
      previous?.executions ?? null,
    ),
  ]);
  return {
    read: {
      project,
      mission: mission.data,
      nodes: nodes.data,
      jobs: jobs.data,
      registrations: registrations.data,
      executions: executions.data,
    },
    faults: [mission.fault, nodes.fault, jobs.fault, registrations.fault, executions.fault].flatMap(
      (fault) => (fault === null ? [] : [fault]),
    ),
  };
}

export async function readOverviewSnapshot(
  previous: OverviewSnapshot | null,
  selectedProjectId: string | null,
): Promise<OverviewSnapshot> {
  const projects = await listProjects();
  const scoped = projects.some((project) => project.id === selectedProjectId);
  const [results, sessions] = await Promise.all([
    Promise.all(
      projects.map((project) =>
        readProject(
          project,
          previous?.reads.find((read) => read.project.id === project.id) ?? null,
        ),
      ),
    ),
    scoped
      ? { data: previous?.sessions ?? null, fault: null }
      : settle(
          null,
          "workbench sessions",
          () => listWorkbenchSessions(null),
          previous?.sessions ?? null,
        ),
  ]);
  return {
    projects,
    reads: results.map((result) => result.read),
    sessions: sessions.data,
    faults: [
      ...results.flatMap((result) => result.faults),
      ...(sessions.fault === null ? [] : [sessions.fault]),
    ],
  };
}
