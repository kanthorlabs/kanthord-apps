import { readMissionNode } from "@/api/resources/mission";
import { listProjects } from "@/api/resources/projects";
import { listProjectExecutions } from "@/api/resources/scheduler";
import type { WorkerRegistrationRecord } from "@/api/types";
import { useResource } from "./use-resource";

export interface InstanceExecution {
  readonly runtimeIdentity: string;
  readonly executionId: string;
  readonly traceId: string | null;
  readonly projectId: string;
  readonly projectName: string;
  readonly nodeId: string | null;
  readonly nodeName: string | null;
}

type Executing = WorkerRegistrationRecord & { readonly execution_id: string };

function executingOf(registrations: readonly WorkerRegistrationRecord[]): readonly Executing[] {
  return registrations.filter(
    (registration): registration is Executing =>
      registration.activity === "executing" && registration.execution_id !== undefined,
  );
}

async function settled<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch {
    return null;
  }
}

async function readExecutions(
  executing: readonly Executing[],
): Promise<readonly InstanceExecution[]> {
  if (executing.length === 0) return [];
  const projects = (await settled(listProjects)) ?? [];
  const projectIds = [...new Set(executing.map((registration) => registration.project_id))];
  const executions = (
    await Promise.all(projectIds.map((id) => settled(() => listProjectExecutions(id))))
  ).flatMap((items) => items ?? []);
  return Promise.all(
    executing.map(async (registration) => {
      const record = executions.find(
        (execution) => execution.execution_id === registration.execution_id,
      );
      const nodeId = record?.node_id ?? null;
      const node = nodeId === null ? null : await settled(() => readMissionNode(nodeId));
      return {
        runtimeIdentity: registration.runtime_identity,
        executionId: registration.execution_id,
        traceId: record?.trace_id ?? null,
        projectId: registration.project_id,
        projectName:
          projects.find((project) => project.id === registration.project_id)?.name ??
          registration.project_id,
        nodeId,
        nodeName: node?.filename ?? null,
      };
    }),
  );
}

export function useInstanceExecutions(
  registrations: readonly WorkerRegistrationRecord[] | null,
): readonly InstanceExecution[] {
  const executing = executingOf(registrations ?? []);
  const key = executing.map((registration) => registration.execution_id);
  const read = useResource(() => readExecutions(executing), key);
  return read.data ?? [];
}
