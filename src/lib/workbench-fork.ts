import { WORKBENCH_FORK_SUMMARY_FAILED, WORKBENCH_FORK_SUMMARY_REFUSED } from "@/api/types";

interface ForkFailure {
  readonly code: string;
  readonly message: string;
  readonly detail: string;
  readonly details?: unknown;
}

export interface ForkFailureLine {
  readonly code: string;
  readonly message: string;
}

const GUARD_UNAVAILABLE = "Guard is unavailable. Check guard@1 on the Agents page.";
const CAUSES_WITH_LINE = ["timeout", "no_verdict", "oversize"];

function stringField(details: unknown, field: string): string | null {
  if (typeof details !== "object" || details === null) return null;
  const value: unknown = Reflect.get(details, field);
  return typeof value === "string" ? value : null;
}

function refusalMessageOf(details: unknown): string {
  const cause = stringField(details, "cause");
  const reason = stringField(details, "reason");
  if (cause === "refused" && reason !== null) return `Guard refused the summary: ${reason}.`;
  if (cause === "unavailable") return GUARD_UNAVAILABLE;
  if (cause !== null && CAUSES_WITH_LINE.includes(cause)) {
    return `Guard refused the summary (${cause}).`;
  }
  return "";
}

export function forkFailureOf(error: ForkFailure): ForkFailureLine {
  if (error.detail === WORKBENCH_FORK_SUMMARY_REFUSED) {
    return { code: error.detail, message: refusalMessageOf(error.details) };
  }
  if (error.detail === WORKBENCH_FORK_SUMMARY_FAILED) return { code: error.detail, message: "" };
  return { code: error.code, message: error.message };
}
