export const API_ERROR_CODES = [
  "unauthorized",
  "forbidden",
  "not_found",
  "conflict",
  "precondition_failed",
  "refused",
  "unreachable",
  "unavailable",
  "malformed",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly detail: string;
  readonly details: unknown;

  constructor(code: ApiErrorCode, message: string, status: number, detail = "", details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.detail = detail;
    this.details = details;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}
