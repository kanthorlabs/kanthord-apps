import { request } from "../client";
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
