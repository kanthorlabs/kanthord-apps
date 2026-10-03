import { ApiError, API_ERROR_CODES, type ApiErrorCode } from "./errors";

export interface Connection {
  readonly baseUrl: string;
  readonly token: string | null;
}

let current: Connection | null = null;

export function setConnection(next: Connection | null): void {
  current = next;
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function codeOf(status: number, named: unknown): ApiErrorCode {
  if (typeof named === "string" && (API_ERROR_CODES as readonly string[]).includes(named)) {
    return named as ApiErrorCode;
  }
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 412) return "precondition_failed";
  if (status === 422) return "refused";
  if (status === 503) return "unavailable";
  return "malformed";
}

function failureOf(status: number, body: unknown): ApiError {
  const envelope = isRecord(body) && isRecord(body["error"]) ? body["error"] : null;
  const source = envelope ?? (isRecord(body) ? body : {});
  const message = source["message"];
  const detail = envelope === null ? source["detail"] : source["code"];
  return new ApiError(
    codeOf(status, envelope === null ? source["code"] : undefined),
    typeof message === "string" ? message : "The daemon refused the request.",
    status,
    typeof detail === "string" ? detail : "",
    envelope === null ? undefined : envelope["details"],
  );
}

export async function request<T>(
  path: string,
  init: { method?: string; body?: unknown; headers?: Readonly<Record<string, string>> } = {},
  connection?: Connection,
): Promise<T> {
  const target = connection ?? current;
  if (target === null) throw new ApiError("unreachable", "No instance is connected.", 0);

  const url = joinUrl(target.baseUrl, path);
  const headers: Record<string, string> = { ...init.headers, accept: "application/json" };
  if (init.body !== undefined) headers["content-type"] = "application/json";
  if (target.token !== null) headers["authorization"] = `Bearer ${target.token}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method ?? "GET",
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError("unreachable", "The daemon did not answer.", 0, url);
  }

  const text = await response.text();
  let body: unknown = null;
  if (text.length > 0) {
    try {
      body = JSON.parse(text);
    } catch {
      if (response.ok)
        throw new ApiError("malformed", "The daemon answered no JSON.", response.status);
    }
  }

  if (!response.ok) throw failureOf(response.status, body);

  return body as T;
}
