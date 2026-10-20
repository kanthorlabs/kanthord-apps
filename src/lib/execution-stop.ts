import type { ExecutionStop, ExecutionStopReason, SchedulerExecutionRecord } from "@/api/types";

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

export function codeLabel(code: string): string {
  return CODE_LABELS[code] ?? code;
}

export function stopLabel(stop: ExecutionStop): string {
  const reason = REASON_LABELS[stop.reason];
  return stop.code === null ? reason : `${reason}: ${codeLabel(stop.code)}`;
}

export function endTimeOf(execution: SchedulerExecutionRecord): number | null {
  if (execution.ended_at !== null) return execution.ended_at;
  return execution.claim_state === "lost" ? execution.expired_at : null;
}

export interface LastEnd {
  readonly execution: SchedulerExecutionRecord;
  readonly endedAt: number;
}

export function lastEndOf(executions: readonly SchedulerExecutionRecord[]): LastEnd | null {
  let last: LastEnd | null = null;
  for (const execution of executions) {
    const endedAt = endTimeOf(execution);
    if (endedAt !== null && (last === null || endedAt > last.endedAt))
      last = { execution, endedAt };
  }
  return last;
}

export function endLabel(execution: SchedulerExecutionRecord): string {
  if (execution.stop !== null) return stopLabel(execution.stop);
  return execution.claim_state === "lost" ? "lost" : "no stop";
}

export function stopSentence(stop: ExecutionStop): string {
  const reason = REASON_LABELS[stop.reason].toLowerCase();
  return stop.code === null ? reason : `${reason} (${codeLabel(stop.code)})`;
}

export type PauseCause = "failure-limit" | "further-work-limit" | "human";

export const PAUSE_CAUSE_LABELS: Readonly<Record<PauseCause, string>> = {
  "failure-limit": "Failure limit",
  "further-work-limit": "Further-work limit",
  human: "Paused by a human",
};

export interface PauseDerivation {
  readonly cause: PauseCause;
  readonly execution: SchedulerExecutionRecord | null;
  readonly endedAt: number | null;
}

export function pauseCauseOf(executions: readonly SchedulerExecutionRecord[]): PauseDerivation {
  let latest: SchedulerExecutionRecord | null = null;
  let latestEnd = 0;
  for (const execution of executions) {
    const end = endTimeOf(execution);
    if (end !== null && (latest === null || end > latestEnd)) {
      latest = execution;
      latestEnd = end;
    }
  }
  if (latest === null) return { cause: "human", execution: null, endedAt: null };
  if (latest.stop?.reason === "budget_end") {
    return { cause: "further-work-limit", execution: latest, endedAt: latestEnd };
  }
  if (latest.claim_state === "lost" || latest.stop !== null) {
    return { cause: "failure-limit", execution: latest, endedAt: latestEnd };
  }
  return { cause: "human", execution: latest, endedAt: latestEnd };
}

export function pauseSentence(pause: PauseDerivation): string {
  const stop = pause.execution?.stop ?? null;
  if (pause.cause === "failure-limit") {
    const ended = `The last execution ended: ${stop === null ? "lost" : stopSentence(stop)}.`;
    return stop?.detail === undefined ? ended : `${ended} Cause: ${stop.detail}`;
  }
  if (pause.cause === "further-work-limit" && stop !== null) {
    return `The last execution ended at its budget${
      stop.code === null ? "" : ` (${codeLabel(stop.code)})`
    }.`;
  }
  return "No execution limit explains the pause.";
}
