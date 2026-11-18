import type { WorkbenchPendingApproval, WorkbenchPendingApprovalGuard } from "@/api/types";

const REVERSIBLE_REASON = "reversible";

const FIXED_GUARD_LINES = {
  import: "Guard: import always needs your approval",
  auto_mode_off: "Auto mode is off",
  unavailable: "Guard: unavailable",
  oversize: "Guard: the request is too large to judge",
  no_verdict: "Guard: no verdict",
  guest_run: "Guard: a guest started this run",
} as const;

export function modelTextOf(reason: string): string {
  return `Model: ${reason}`;
}

export function guardLineOf(guard: WorkbenchPendingApprovalGuard): string {
  if (guard.cause !== "classifier") return FIXED_GUARD_LINES[guard.cause];
  if (guard.reason === null) return FIXED_GUARD_LINES.no_verdict;
  const confidence = guard.confidence === null ? "" : ` (${guard.confidence.toFixed(2)})`;
  return `Guard: ${modelTextOf(guard.reason)}${confidence}`;
}

export function ranWithoutApprovalLineOf(reason: string): string {
  const text = reason === REVERSIBLE_REASON ? reason : modelTextOf(reason);
  return `Ran without approval: ${text}`;
}

export function guestRequestLineOf(approval: WorkbenchPendingApproval): string | null {
  const { requested_by } = approval;
  return requested_by.kind === "guest"
    ? `Requested in a run started by ${requested_by.name} (guest)`
    : null;
}

export function approvalLinesOf(approval: WorkbenchPendingApproval): readonly string[] {
  const request = guestRequestLineOf(approval);
  const { guard } = approval;
  const guardLine = guard === null || guard.cause === "guest_run" ? null : guardLineOf(guard);
  return [request, guardLine].filter((line) => line !== null);
}
