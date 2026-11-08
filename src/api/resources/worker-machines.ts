import { newIdempotencyKey } from "@/lib/idempotency-key";
import { request } from "../client";
import { readAllPages } from "../pages";
import type {
  WorkerMachine,
  WorkerMachineCreateBody,
  WorkerMachineDetail,
  WorkerMachineListItem,
  WorkerMachineWriteAnswer,
} from "../types";

const MACHINE_PATH = "/api/worker/machine";

function machinePath(machineName: string): string {
  return `${MACHINE_PATH}/${encodeURIComponent(machineName)}`;
}

export async function listWorkerMachines(): Promise<readonly WorkerMachineListItem[]> {
  return readAllPages<WorkerMachineListItem>(MACHINE_PATH);
}

export async function readWorkerMachine(machineName: string): Promise<WorkerMachineDetail> {
  return request<WorkerMachineDetail>(machinePath(machineName));
}

export async function createWorkerMachine(
  body: WorkerMachineCreateBody,
): Promise<WorkerMachineWriteAnswer> {
  return request<WorkerMachineWriteAnswer>(MACHINE_PATH, {
    method: "POST",
    body,
    headers: { "idempotency-key": newIdempotencyKey() },
  });
}

export async function rotateWorkerMachineKey(
  machineName: string,
  expectedRevision: number,
): Promise<WorkerMachineWriteAnswer> {
  return request<WorkerMachineWriteAnswer>(`${machinePath(machineName)}/revision`, {
    method: "POST",
    body: { expected_revision: expectedRevision },
    headers: { "idempotency-key": newIdempotencyKey() },
  });
}

export async function archiveWorkerMachine(
  machineName: string,
  expectedRevision: number,
): Promise<WorkerMachine> {
  return request<WorkerMachine>(`${machinePath(machineName)}/archive`, {
    method: "POST",
    body: { expected_revision: expectedRevision },
    headers: { "idempotency-key": newIdempotencyKey() },
  });
}
