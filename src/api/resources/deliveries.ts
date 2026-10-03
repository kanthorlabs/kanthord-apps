import { request } from "../client";
import type { Delivery } from "../types";

export async function listDeliveries(projectId: string): Promise<readonly Delivery[]> {
  return request<readonly Delivery[]>(`/v1/projects/${projectId}/deliveries`);
}
