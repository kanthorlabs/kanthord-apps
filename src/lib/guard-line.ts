import type {
  WorkbenchGuardRecord,
  WorkbenchPendingApproval,
  WorkbenchPendingApprovalGuard,
} from "@/api/types";
import type { ToolCallResult } from "./workbench-chat";

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

function errorCodeOf(text: string): string {
  try {
    const parsed: unknown = JSON.parse(text);
    const error =
      typeof parsed === "object" && parsed !== null ? Reflect.get(parsed, "error") : null;
    const code =
      typeof error === "object" && error !== null ? Reflect.get(error, "code") : undefined;
    return typeof code === "string" ? code : text.trim();
  } catch {
    return text.trim();
  }
}

export function guardRecordLineOf(
  guard: WorkbenchGuardRecord,
  result: ToolCallResult | null,
): string | null {
  if (guard.grant === undefined) return ranWithoutApprovalLineOf(guard.reason);
  if (result === null) return null;
  if (result.isError) return `Refused: ${errorCodeOf(result.text)}`;
  return `Ran without approval for ${guard.grant.author.name} (guest): ${guard.reason}`;
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
