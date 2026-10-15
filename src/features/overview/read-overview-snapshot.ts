import { listMissionNodes, readMission } from "@/api/resources/mission";
import { listProjects } from "@/api/resources/projects";
import { listQueueJobs } from "@/api/resources/scheduler";
import type { Mission, MissionNodeRecord, Project, SchedulerJob } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";

export interface ProjectRead {
  readonly project: Project;
  readonly mission: Mission | null;
  readonly nodes: readonly MissionNodeRecord[] | null;
  readonly jobs: readonly SchedulerJob[] | null;
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
  readonly faults: readonly ReadFault[];
}

interface Settled<T> {
  readonly data: T | null;
  readonly fault: ReadFault | null;
}

async function settle<T>(
  project: Project,
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
        projectId: project.id,
        projectName: project.name,
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
  const [nodes, jobs] = await Promise.all([
    readNodes(project, mission.data, previous),
    settle(project, "queue", () => listQueueJobs(project.id), previous?.jobs ?? null),
  ]);
  return {
    read: { project, mission: mission.data, nodes: nodes.data, jobs: jobs.data },
    faults: [mission.fault, nodes.fault, jobs.fault].flatMap((fault) =>
      fault === null ? [] : [fault],
    ),
  };
}

export async function readOverviewSnapshot(
  previous: OverviewSnapshot | null,
): Promise<OverviewSnapshot> {
  const projects = await listProjects();
  const results = await Promise.all(
    projects.map((project) =>
      readProject(project, previous?.reads.find((read) => read.project.id === project.id) ?? null),
    ),
  );
  return {
    projects,
    reads: results.map((result) => result.read),
    faults: results.flatMap((result) => result.faults),
  };
}
