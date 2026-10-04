import { newUlid } from "@/lib/ulid";
import { request } from "../client";
import { readAllPages } from "../pages";
import type {
  Credential,
  CredentialCreateBody,
  CredentialLoginBody,
  CredentialLoginSession,
  CredentialLoginStatus,
  CredentialMetadataBody,
  CredentialPlatform,
  CredentialPlatformList,
  CredentialRotateBody,
  Page,
} from "../types";

function credentialPath(credentialName: string): string {
  return `/api/credential/${encodeURIComponent(credentialName)}`;
}

export async function listCredentialPage(
  platform: CredentialPlatform | null,
  cursor: string | null,
  includeArchived = false,
): Promise<Page<Credential>> {
  const query = new URLSearchParams();
  if (platform !== null) query.set("platform", platform);
  if (includeArchived) query.set("includeArchived", "true");
  if (cursor !== null) query.set("cursor", cursor);
  const suffix = query.size === 0 ? "" : `?${query}`;
  return request<Page<Credential>>(`/api/credential${suffix}`);
}

export async function listCredentialPlatforms(): Promise<CredentialPlatformList> {
  return request<CredentialPlatformList>("/api/credential/platform");
}

export async function readCredential(credentialName: string): Promise<Credential> {
  return request<Credential>(credentialPath(credentialName));
}

export async function createCredential(body: CredentialCreateBody): Promise<Credential> {
  return request<Credential>("/api/credential", {
    method: "POST",
    body,
    headers: { "idempotency-key": newUlid() },
  });
}

export async function rotateCredential(
  credentialName: string,
  body: CredentialRotateBody,
): Promise<Credential> {
  return request<Credential>(`${credentialPath(credentialName)}/revision`, {
    method: "POST",
    body,
    headers: { "idempotency-key": newUlid() },
  });
}

export async function updateCredentialMetadata(
  credentialName: string,
  body: CredentialMetadataBody,
): Promise<Credential> {
  return request<Credential>(`${credentialPath(credentialName)}/metadata`, {
    method: "PUT",
    body,
    headers: { "idempotency-key": newUlid() },
  });
}

export async function revokeCredentialRevision(
  credentialName: string,
  revision: number,
): Promise<Credential> {
  return request<Credential>(`${credentialPath(credentialName)}/revision/${revision}/revoke`, {
    method: "POST",
    headers: { "idempotency-key": newUlid() },
  });
}

export async function archiveCredential(credentialName: string): Promise<Credential> {
  return request<Credential>(`${credentialPath(credentialName)}/archive`, {
    method: "POST",
    headers: { "idempotency-key": newUlid() },
  });
}

export async function startCredentialLogin(
  body: CredentialLoginBody,
): Promise<CredentialLoginSession> {
  return request<CredentialLoginSession>("/api/credential/login", {
    method: "POST",
    body,
    headers: { "idempotency-key": newUlid() },
  });
}

export async function submitCredentialLoginCode(
  sessionId: string,
  value: string,
): Promise<{ readonly sessionId: string }> {
  return request<{ readonly sessionId: string }>(
    `/api/credential/login/${encodeURIComponent(sessionId)}/code`,
    { method: "POST", body: { value }, headers: { "idempotency-key": newUlid() } },
  );
}

export async function readCredentialLoginStatus(sessionId: string): Promise<CredentialLoginStatus> {
  return request<CredentialLoginStatus>(`/api/credential/login/${encodeURIComponent(sessionId)}`);
}

export async function listCredentials(
  platform: CredentialPlatform,
): Promise<readonly Credential[]> {
  return readAllPages<Credential>("/api/credential", { platform });
}
