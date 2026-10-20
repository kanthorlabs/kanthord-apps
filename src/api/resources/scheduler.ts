import { request } from "../client";
import { readAllPages } from "../pages";
import type { Page, SchedulerExecutionRecord, SchedulerJob } from "../types";

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

export async function listProjectExecutionPage(
  projectId: string,
  cursor: string | null,
  limit: number,
): Promise<Page<SchedulerExecutionRecord>> {
  const query = new URLSearchParams({ limit: String(limit) });
  if (cursor !== null) query.set("cursor", cursor);
  return request<Page<SchedulerExecutionRecord>>(
    `/api/scheduler/project/${encodeURIComponent(projectId)}/execution?${query}`,
  );
}

export async function listNodeExecutions(
  projectId: string,
  nodeId: string,
  attempt?: number,
): Promise<readonly SchedulerExecutionRecord[]> {
  return readAllPages<SchedulerExecutionRecord>(
    `/api/scheduler/project/${encodeURIComponent(projectId)}/execution`,
    attempt === undefined ? { node_id: nodeId } : { node_id: nodeId, attempt: String(attempt) },
  );
}
