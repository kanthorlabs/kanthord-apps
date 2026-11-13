import type { ApiError } from "@/api/errors";

export type ActResult =
  { readonly ok: true } | { readonly ok: false; readonly code: string | null };

export const ACT_DONE: ActResult = { ok: true };

export function actFailureOf(failure: ApiError): ActResult {
  return { ok: false, code: failure.detail === "" ? null : failure.detail };
}
