import {
  listMissionNodes,
  listProjectFollowups,
  listUndecidedFindings,
  readMission,
} from "@/api/resources/mission";
import { listProjectEnvironments, listProjects } from "@/api/resources/projects";
import { listProjectExecutionPage, listQueueJobs } from "@/api/resources/scheduler";
import { listWorkbenchSessions } from "@/api/resources/workbench";
import { listWorkerRegistrations } from "@/api/resources/workers";
import { isRouteAbsent } from "@/api/errors";
import type {
  EnvironmentState,
  Mission,
  MissionFinding,
  MissionFollowupProposal,
  MissionNodeRecord,
  Project,
  SchedulerExecutionRecord,
  SchedulerJob,
  WorkbenchSessionListItem,
  WorkerRegistrationRecord,
} from "@/api/types";
import { asApiError } from "@/hooks/use-resource";

import { limitReads } from "./limit-reads";

const EXECUTION_PAGE_LIMIT = 100;

export interface ProjectRead {
  readonly project: Project;
  readonly mission: Mission | null;
  readonly nodes: readonly MissionNodeRecord[] | null;
  readonly jobs: readonly SchedulerJob[] | null;
  readonly registrations: readonly WorkerRegistrationRecord[] | null;
  readonly executions: readonly SchedulerExecutionRecord[] | null;
  readonly environments: readonly EnvironmentState[] | null;
  readonly findings: readonly MissionFinding[] | null;
  readonly followups?: readonly MissionFollowupProposal[] | null;
  readonly absent: readonly string[];
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
  readonly absent: readonly string[];
}

export interface Settled<T> {
  readonly data: T | null;
  readonly fault: ReadFault | null;
  readonly absent: boolean;
}

export async function settle<T>(
  project: Project | null,
  source: string,
  read: () => Promise<T>,
  kept: T | null,
): Promise<Settled<T>> {
  try {
    return { data: await read(), fault: null, absent: false };
  } catch (cause: unknown) {
    const error = asApiError(cause);
    if (isRouteAbsent(error)) return { data: null, fault: null, absent: true };
    return {
      data: kept,
      absent: false,
      fault: {
        projectId: project?.id ?? null,
        projectName: project?.name ?? null,
        source,
        message: error.message,
      },
    };
  }
}

function absentSourcesOf(sources: Readonly<Record<string, Settled<unknown>>>): readonly string[] {
  return Object.entries(sources).flatMap(([source, settled]) => (settled.absent ? [source] : []));
}

function settleLimited<T>(
  project: Project | null,
  source: string,
  read: () => Promise<T>,
  kept: T | null,
): Promise<Settled<T>> {
  return settle(project, source, () => limitReads(read), kept);
}

async function readNodes(
  project: Project,
  mission: Mission | null,
  previous: ProjectRead | null,
): Promise<Settled<readonly MissionNodeRecord[]>> {
  if (mission === null) return { data: previous?.nodes ?? null, fault: null, absent: false };
  return settleLimited(
    project,
    "node list",
    () => listMissionNodes(mission.id),
    previous?.nodes ?? null,
  );
}

async function readFindings(
  project: Project,
  mission: Mission | null,
  previous: ProjectRead | null,
): Promise<Settled<readonly MissionFinding[]>> {
  if (mission === null) return { data: previous?.findings ?? null, fault: null, absent: false };
  return settleLimited(
    project,
    "undecided findings",
    () => listUndecidedFindings(project.id),
    previous?.findings ?? null,
  );
}

async function readFollowups(
  project: Project,
  mission: Mission | null,
  previous: ProjectRead | null,
): Promise<Settled<readonly MissionFollowupProposal[]>> {
  if (mission === null) return { data: previous?.followups ?? null, fault: null, absent: false };
  return settleLimited(
    project,
    "follow-up proposals",
    () => listProjectFollowups(project.id),
    previous?.followups ?? null,
  );
}

function readMissionOf(project: Project, previous: ProjectRead | null): Promise<Settled<Mission>> {
  return settleLimited(
    project,
    "mission",
    () => readMission(project.id),
    previous?.mission ?? null,
  );
}

function readJobs(
  project: Project,
  previous: ProjectRead | null,
): Promise<Settled<readonly SchedulerJob[]>> {
  return settleLimited(project, "queue", () => listQueueJobs(project.id), previous?.jobs ?? null);
}

function readRegistrations(
  project: Project,
  previous: ProjectRead | null,
): Promise<Settled<readonly WorkerRegistrationRecord[]>> {
  return settleLimited(
    project,
    "worker registrations",
    () => listWorkerRegistrations(project.id),
    previous?.registrations ?? null,
  );
}

function readExecutions(
  project: Project,
  previous: ProjectRead | null,
): Promise<Settled<readonly SchedulerExecutionRecord[]>> {
  return settleLimited(
    project,
    "executions",
    async () => (await listProjectExecutionPage(project.id, null, EXECUTION_PAGE_LIMIT)).items,
    previous?.executions ?? null,
  );
}

function readEnvironments(
  project: Project,
  previous: ProjectRead | null,
): Promise<Settled<readonly EnvironmentState[]>> {
  return settleLimited(
    project,
    "environment list",
    () => listProjectEnvironments(project.id),
    previous?.environments ?? null,
  );
}

function readSessions(
  previous: OverviewSnapshot | null,
): Promise<Settled<readonly WorkbenchSessionListItem[]>> {
  return settleLimited(
    null,
    "workbench sessions",
    () => listWorkbenchSessions(null),
    previous?.sessions ?? null,
  );
}

interface ProjectResult {
  readonly read: ProjectRead;
  readonly faults: readonly ReadFault[];
}

interface ProjectSources {
  readonly mission: Settled<Mission>;
  readonly nodes: Settled<readonly MissionNodeRecord[]>;
  readonly findings: Settled<readonly MissionFinding[]>;
  readonly followups: Settled<readonly MissionFollowupProposal[]>;
  readonly jobs: Settled<readonly SchedulerJob[]>;
  readonly registrations: Settled<readonly WorkerRegistrationRecord[]>;
  readonly executions: Settled<readonly SchedulerExecutionRecord[]>;
  readonly environments: Settled<readonly EnvironmentState[]>;
}

function resultOf(
  project: Project,
  {
    mission,
    nodes,
    findings,
    followups,
    jobs,
    registrations,
    executions,
    environments,
  }: ProjectSources,
): ProjectResult {
  return {
    read: {
      project,
      mission: mission.data,
      nodes: nodes.data,
      jobs: jobs.data,
      registrations: registrations.data,
      executions: executions.data,
      environments: environments.data,
      findings: findings.data,
      followups: followups.data,
      absent: absentSourcesOf({
        mission,
        "node list": nodes,
        "undecided findings": findings,
        "follow-up proposals": followups,
        queue: jobs,
        "worker registrations": registrations,
        executions,
        "environment list": environments,
      }),
    },
    faults: [
      mission.fault,
      nodes.fault,
      findings.fault,
      followups.fault,
      jobs.fault,
      registrations.fault,
      executions.fault,
      environments.fault,
    ].flatMap((fault) => (fault === null ? [] : [fault])),
  };
}

async function readProject(project: Project, previous: ProjectRead | null): Promise<ProjectResult> {
  const mission = await readMissionOf(project, previous);
  const [nodes, findings, followups, jobs, registrations, executions, environments] =
    await Promise.all([
      readNodes(project, mission.data, previous),
      readFindings(project, mission.data, previous),
      readFollowups(project, mission.data, previous),
      readJobs(project, previous),
      readRegistrations(project, previous),
      readExecutions(project, previous),
      readEnvironments(project, previous),
    ]);
  return resultOf(project, {
    mission,
    nodes,
    findings,
    followups,
    jobs,
    registrations,
    executions,
    environments,
  });
}

async function retryProject(
  previous: ProjectRead,
  faults: readonly ReadFault[],
): Promise<ProjectResult> {
  const { project } = previous;
  const failed = new Set(faults.map((fault) => fault.source));
  const again = <T>(
    source: string,
    force: boolean,
    kept: T | null,
    read: () => Promise<Settled<T>>,
  ): Promise<Settled<T>> =>
    force || failed.has(source)
      ? read()
      : Promise.resolve({ data: kept, fault: null, absent: previous.absent.includes(source) });
  const mission = await again("mission", false, previous.mission, () =>
    readMissionOf(project, previous),
  );
  const missionRead = failed.has("mission") && mission.fault === null && mission.data !== null;
  const [nodes, findings, followups, jobs, registrations, executions, environments] =
    await Promise.all([
      again("node list", missionRead, previous.nodes, () =>
        readNodes(project, mission.data, previous),
      ),
      again("undecided findings", missionRead, previous.findings, () =>
        readFindings(project, mission.data, previous),
      ),
      again("follow-up proposals", missionRead, previous.followups ?? null, () =>
        readFollowups(project, mission.data, previous),
      ),
      again("queue", false, previous.jobs, () => readJobs(project, previous)),
      again("worker registrations", false, previous.registrations, () =>
        readRegistrations(project, previous),
      ),
      again("executions", false, previous.executions, () => readExecutions(project, previous)),
      again("environment list", false, previous.environments, () =>
        readEnvironments(project, previous),
      ),
    ]);
  return resultOf(project, {
    mission,
    nodes,
    findings,
    followups,
    jobs,
    registrations,
    executions,
    environments,
  });
}

function snapshotOf(
  projects: readonly Project[],
  results: readonly ProjectResult[],
  sessions: Settled<readonly WorkbenchSessionListItem[]>,
): OverviewSnapshot {
  return {
    projects,
    reads: results.map((result) => result.read),
    sessions: sessions.data,
    faults: [
      ...results.flatMap((result) => result.faults),
      ...(sessions.fault === null ? [] : [sessions.fault]),
    ],
    absent: [
      ...new Set([
        ...results.flatMap((result) => result.read.absent),
        ...absentSourcesOf({ "workbench sessions": sessions }),
      ]),
    ],
  };
}

export async function readOverviewSnapshot(
  previous: OverviewSnapshot | null,
  _selectedProjectId: string | null,
): Promise<OverviewSnapshot> {
  const projects = await limitReads(listProjects);
  const [results, sessions] = await Promise.all([
    Promise.all(
      projects.map((project) =>
        readProject(
          project,
          previous?.reads.find((read) => read.project.id === project.id) ?? null,
        ),
      ),
    ),
    readSessions(previous),
  ]);
  return snapshotOf(projects, results, sessions);
}

export async function retryFaults(previous: OverviewSnapshot): Promise<OverviewSnapshot> {
  const sessionsFailed = previous.faults.some((fault) => fault.source === "workbench sessions");
  const [results, sessions] = await Promise.all([
    Promise.all(
      previous.reads.map((read) =>
        retryProject(
          read,
          previous.faults.filter((fault) => fault.projectId === read.project.id),
        ),
      ),
    ),
    sessionsFailed
      ? readSessions(previous)
      : Promise.resolve<Settled<readonly WorkbenchSessionListItem[]>>({
          data: previous.sessions,
          fault: null,
          absent: previous.absent.includes("workbench sessions"),
        }),
  ]);
  return snapshotOf(previous.projects, results, sessions);
}
