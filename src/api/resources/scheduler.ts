import { readAllPages } from "../pages";
import type { SchedulerExecutionRecord, SchedulerJob } from "../types";

export async function listQueueJobs(projectId: string): Promise<readonly SchedulerJob[]> {
  return readAllPages<SchedulerJob>(
    `/api/scheduler/project/${encodeURIComponent(projectId)}/queue`,
  );
}

export async function listProjectExecutions(
  projectId: string,
): Promise<readonly SchedulerExecutionRecord[]> {
  return readAllPages<SchedulerExecutionRecord>(
    `/api/scheduler/project/${encodeURIComponent(projectId)}/execution`,
  );
}

export async function listNodeExecutions(
  projectId: string,
  nodeId: string,
  attempt: number,
): Promise<readonly SchedulerExecutionRecord[]> {
  return readAllPages<SchedulerExecutionRecord>(
    `/api/scheduler/project/${encodeURIComponent(projectId)}/execution`,
    { nodeId, attempt: String(attempt) },
  );
}
