import type { ExecutionStop, ExecutionStopReason } from "@/api/types";

const REASON_LABELS: Record<ExecutionStopReason, string> = {
  operation_failed: "Operation failed",
  judgement_invalid: "Judgement invalid",
  report_absent: "Report absent",
  action_unsettled: "Action unsettled",
  assessment_absent: "Assessment absent",
  budget_end: "Budget ended",
  provider_failed: "Provider failed",
  no_progress: "No progress",
};

const CODE_LABELS: Readonly<Record<string, string>> = {
  turns: "turns",
  wall_time: "wall time",
  rate_limited: "rate limited",
  quota_exhausted: "quota exhausted",
  unauthorized: "unauthorized",
  bad_request: "bad request",
  unavailable: "unavailable",
};

function codeLabel(code: string): string {
  return CODE_LABELS[code] ?? code;
}

export function stopLabel(stop: ExecutionStop): string {
  const reason = REASON_LABELS[stop.reason];
  return stop.code === null ? reason : `${reason}: ${codeLabel(stop.code)}`;
}
