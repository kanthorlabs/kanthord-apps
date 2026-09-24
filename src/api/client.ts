import { ApiError, API_ERROR_CODES, type ApiErrorCode } from "./errors";

const BASE_URL = import.meta.env["VITE_KANTHORD_URL"] ?? "http://localhost:31415";

let token: string | null = null;

export function setToken(next: string | null): void {
  token = next;
}

export function getToken(): string | null {
  return token;
}

function codeOf(status: number, body: unknown): ApiErrorCode {
  const named = (body as { code?: unknown } | null)?.code;
  if (typeof named === "string" && (API_ERROR_CODES as readonly string[]).includes(named)) {
    return named as ApiErrorCode;
  }
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 412) return "precondition_failed";
  if (status === 422) return "refused";
  return "malformed";
}

export async function request<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (init.body !== undefined) headers["content-type"] = "application/json";
  if (token !== null) headers["authorization"] = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError("unreachable", "The daemon did not answer.", 0, `${BASE_URL}${path}`);
  }

  const text = await response.text();
  const body: unknown = text.length === 0 ? null : JSON.parse(text);

  if (!response.ok) {
    const message = (body as { message?: unknown } | null)?.message;
    const detail = (body as { detail?: unknown } | null)?.detail;
    throw new ApiError(
      codeOf(response.status, body),
      typeof message === "string" ? message : `The daemon refused the request.`,
      response.status,
      typeof detail === "string" ? detail : "",
    );
  }

  return body as T;
}
