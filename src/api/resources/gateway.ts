import { request, requestText } from "../client";
import { ApiError, isApiError } from "../errors";
import type { HumanIdentity, LivenessReport, ServiceMaps } from "../types";

const UNHEALTHY_CODE = "gateway.liveness.unhealthy";

interface LivenessBody {
  readonly services: ServiceMaps;
}

export async function readLiveness(baseUrl: string): Promise<LivenessReport> {
  try {
    const body = await request<LivenessBody>("/api/liveness", {}, { baseUrl, token: null });
    return { healthy: true, services: body.services };
  } catch (error) {
    if (isApiError(error) && error.status === 503 && error.detail === UNHEALTHY_CODE) {
      return { healthy: false, services: error.details as ServiceMaps };
    }
    throw error;
  }
}

export async function verifyHumanToken(baseUrl: string, token: string): Promise<HumanIdentity> {
  const identity = await request<HumanIdentity>("/api/auth/verify", {}, { baseUrl, token });
  if (identity.kind !== "human") {
    throw new ApiError("unauthorized", "The token is not a human token.", 401);
  }
  return identity;
}

const INFO_VERSION = /^info:\r?\n(?:[ \t]+.*\r?\n)*?[ \t]+version:[ \t]*["']?([^"'\s]+)/m;

export async function readServerVersion(): Promise<string> {
  const version = INFO_VERSION.exec(await requestText("/api/openapi.yaml"))?.[1];
  if (version === undefined) {
    throw new ApiError("malformed", "The OpenAPI index holds no version.", 0, "/api/openapi.yaml");
  }
  return version;
}
