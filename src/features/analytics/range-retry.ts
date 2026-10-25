import type { ApiError } from "@/api/errors";

const RANGE_INVALID = "tracking.analytics.range_invalid";

export function rangeRetryOf(error: ApiError | null, reload: () => void): (() => void) | undefined {
  return error?.detail === RANGE_INVALID ? undefined : reload;
}
