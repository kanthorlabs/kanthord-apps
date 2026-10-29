import { newIdempotencyKey } from "@/lib/idempotency-key";
import { request } from "../client";
import { readAllPages } from "../pages";
import type {
  WorkerInstance,
  WorkerInstanceArchiveBody,
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
    headers: { "idempotency-key": newIdempotencyKey() },
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
    headers: { "idempotency-key": newIdempotencyKey() },
  });
}

export async function archiveWorkerInstance(
  instanceName: string,
  expectedRevision: number,
  options: Pick<WorkerInstanceArchiveBody, "force"> = {},
): Promise<WorkerInstance> {
  const body: WorkerInstanceArchiveBody = {
    expected_revision: expectedRevision,
    ...(options.force === undefined ? {} : { force: options.force }),
  };
  return request<WorkerInstance>(`${instancePath(instanceName)}/archive`, {
    method: "POST",
    body,
    headers: { "idempotency-key": newIdempotencyKey() },
  });
}
