import { request } from "../client";
import type { Delivery, ObservationRecord } from "../types";

export async function listDeliveries(projectId: string): Promise<readonly Delivery[]> {
  return request<readonly Delivery[]>(`/v1/projects/${projectId}/deliveries`);
}

export async function listObservations(projectId: string): Promise<readonly ObservationRecord[]> {
  return request<readonly ObservationRecord[]>(`/v1/projects/${projectId}/observations`);
}
