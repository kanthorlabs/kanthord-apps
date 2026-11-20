import type { WorkbenchPendingApproval } from "@/api/types";

import type { DetailRead } from "./attention";
import { guestRequestLineOf } from "./guard-line";

export interface ChangeRow {
  readonly field: string;
  readonly label: string;
  readonly text: string;
  readonly json: boolean;
}

export interface ChangeAsked {
  readonly operationId: string;
  readonly rows: readonly ChangeRow[];
}

const JSON_INDENT = 2;

function rowOf(field: string, value: unknown): ChangeRow {
  const label = `${field} becomes`;
  if (typeof value === "string") return { field, label, text: value, json: false };
  return { field, label, text: JSON.stringify(value, null, JSON_INDENT), json: true };
}

export function changeAskedOf(pending: WorkbenchPendingApproval | null): ChangeAsked | null {
  if (pending === null) return null;
  return {
    operationId: pending.operation_id,
    rows: Object.entries(pending.input).map(([field, value]) => rowOf(field, value)),
  };
}

export function requestLineOf(
  read: DetailRead<WorkbenchPendingApproval | null> | null,
): string | null {
  if (read === null || read.status === "failed" || read.data === null) return null;
  return guestRequestLineOf(read.data);
}
