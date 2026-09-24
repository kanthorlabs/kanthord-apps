export const API_ERROR_CODES = [
  "unauthorized",
  "forbidden",
  "not_found",
  "conflict",
  "precondition_failed",
  "refused",
  "unreachable",
  "malformed",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly detail: string;

  constructor(code: ApiErrorCode, message: string, status: number, detail = "") {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}
