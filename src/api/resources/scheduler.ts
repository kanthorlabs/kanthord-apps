import { request } from "../client";
import type { EligibilityReport, Execution, WorkQueueEntry } from "../types";

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
