import { request } from "../client";
import { readAllPages } from "../pages";
import type {
  EligibilityReport,
  Execution,
  SchedulerExecutionRecord,
  WorkQueueEntry,
} from "../types";

export async function listQueue(projectId: string): Promise<readonly WorkQueueEntry[]> {
  return request<readonly WorkQueueEntry[]>(`/v1/projects/${projectId}/scheduler/queue`);
}

export async function listExecutions(
  projectId: string,
  scope: "live" | "all",
): Promise<readonly Execution[]> {
  return request<readonly Execution[]>(
    `/v1/projects/${projectId}/scheduler/executions?scope=${scope}`,
  );
}

export async function readEligibility(
  projectId: string,
  nodeId: string,
): Promise<EligibilityReport> {
  return request<EligibilityReport>(`/v1/projects/${projectId}/scheduler/eligibility/${nodeId}`);
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
