import { request } from "../client";
import type { WorkerInstance, WorkerTemplate } from "../types";

export async function listTemplates(): Promise<readonly WorkerTemplate[]> {
  return request<readonly WorkerTemplate[]>("/v1/workers/templates");
}

export async function listInstances(projectId: string): Promise<readonly WorkerInstance[]> {
  return request<readonly WorkerInstance[]>(`/v1/projects/${projectId}/workers/instances`);
}
