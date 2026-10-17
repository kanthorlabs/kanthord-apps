import { listMissionNodes, readMission } from "@/api/resources/mission";
import { listProjects, listWorkerBindings } from "@/api/resources/projects";
import {
  listNodeExecutions,
  listProjectExecutionPage,
  listQueueJobs,
} from "@/api/resources/scheduler";
import { listWorkerInstances } from "@/api/resources/workers";
import type {
  MissionNodeRecord,
  Project,
  SchedulerExecutionRecord,
  SchedulerJob,
  WorkerBindingRecord,
  WorkerInstanceRecord,
} from "@/api/types";

const EXECUTION_PAGE_LIMIT = 100;

export interface ProjectBoard {
  readonly project: Project;
  readonly nodes: readonly MissionNodeRecord[];
  readonly jobs: readonly SchedulerJob[];
  readonly instances: readonly WorkerInstanceRecord[];
  readonly bindings: readonly WorkerBindingRecord[];
  readonly executions: readonly SchedulerExecutionRecord[];
}

export interface BoardSnapshot {
  readonly projects: readonly Project[];
  readonly boards: readonly ProjectBoard[];
}

function holdsClaim(node: MissionNodeRecord): boolean {
  return node.state === "Executing" || node.state === "Evaluating";
}

async function readMissingClaims(
  projectId: string,
  nodes: readonly MissionNodeRecord[],
  page: readonly SchedulerExecutionRecord[],
): Promise<readonly SchedulerExecutionRecord[]> {
  const missing = nodes
    .filter(holdsClaim)
    .filter(
      (node) => !page.some((item) => item.node_id === node.id && item.claim_state === "running"),
    );
  const found = await Promise.all(
    missing.map((node) => listNodeExecutions(projectId, node.id, node.attempt)),
  );
  return found.flat().filter((item) => item.claim_state === "running");
}

async function readProjectBoard(project: Project): Promise<ProjectBoard> {
  const mission = await readMission(project.id);
  const [nodes, jobs, instances, bindings, page] = await Promise.all([
    listMissionNodes(mission.id),
    listQueueJobs(project.id),
    listWorkerInstances(project.id),
    listWorkerBindings(project.id),
    listProjectExecutionPage(project.id, null, EXECUTION_PAGE_LIMIT),
  ]);
  const missing = await readMissingClaims(project.id, nodes, page.items);
  return { project, nodes, jobs, instances, bindings, executions: [...page.items, ...missing] };
}

export async function readSchedulerBoard(): Promise<BoardSnapshot> {
  const projects = await listProjects();
  const boards = await Promise.all(projects.map(readProjectBoard));
  return { projects, boards };
}
