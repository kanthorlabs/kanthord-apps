import { newUlid } from "@/lib/ulid";
import { request } from "../client";
import { readAllPages } from "../pages";
import type {
  WorkerInstance,
  WorkerInstanceCreateBody,
  WorkerInstanceDetail,
  WorkerInstanceListItem,
  WorkerInstanceWriteAnswer,
} from "../types";

const INSTANCE_PATH = "/api/worker/instance";

function instancePath(instanceName: string): string {
  return `${INSTANCE_PATH}/${encodeURIComponent(instanceName)}`;
}

export async function listWorkerInstances(
  worker: string | null = null,
): Promise<readonly WorkerInstanceListItem[]> {
  return readAllPages<WorkerInstanceListItem>(INSTANCE_PATH, worker === null ? {} : { worker });
}

export async function readWorkerInstance(instanceName: string): Promise<WorkerInstanceDetail> {
  return request<WorkerInstanceDetail>(instancePath(instanceName));
}

export async function createWorkerInstance(
  body: WorkerInstanceCreateBody,
): Promise<WorkerInstanceWriteAnswer> {
  return request<WorkerInstanceWriteAnswer>(INSTANCE_PATH, {
    method: "POST",
    body,
    headers: { "idempotency-key": newUlid() },
  });
}

export async function resetWorkerInstanceKey(
  instanceName: string,
  endpoint: string,
  expectedRevision: number,
): Promise<WorkerInstanceWriteAnswer> {
  return request<WorkerInstanceWriteAnswer>(`${instancePath(instanceName)}/revision`, {
    method: "POST",
    body: { endpoint, expected_revision: expectedRevision },
    headers: { "idempotency-key": newUlid() },
  });
}

export async function archiveWorkerInstance(
  instanceName: string,
  expectedRevision: number,
): Promise<WorkerInstance> {
  return request<WorkerInstance>(`${instancePath(instanceName)}/archive`, {
    method: "POST",
    body: { expected_revision: expectedRevision },
    headers: { "idempotency-key": newUlid() },
  });
}
