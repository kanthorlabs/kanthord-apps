import { newUlid } from "@/lib/ulid";
import { request } from "../client";
import { readAllPages } from "../pages";
import type {
  ComponentCredential,
  Credential,
  CredentialCheckBody,
  CredentialComponent,
  CredentialCreateBody,
  CredentialLoginBody,
  CredentialLoginSession,
  CredentialLoginStatus,
  CredentialMetadataBody,
  CredentialPlatform,
  CredentialPlatformList,
  CredentialRotateBody,
  HealthEntry,
  Page,
  SshDiscoverResult,
} from "../types";

const LOGIN_PATH = "/api/llm/credential/login";

function credentialRoot(component: CredentialComponent): string {
  return `/api/${component}/credential`;
}

function credentialPath(component: CredentialComponent, credentialName: string): string {
  return `${credentialRoot(component)}/${encodeURIComponent(credentialName)}`;
}

export async function listCredentialPage(
  component: CredentialComponent,
  platform: CredentialPlatform | null,
  cursor: string | null,
  includeArchived = false,
): Promise<Page<Credential>> {
  const query = new URLSearchParams();
  if (platform !== null) query.set("platform", platform);
  if (includeArchived) query.set("includeArchived", "true");
  if (cursor !== null) query.set("cursor", cursor);
  const suffix = query.size === 0 ? "" : `?${query}`;
  return request<Page<Credential>>(`${credentialRoot(component)}${suffix}`);
}

export async function listCredentialPlatforms(
  component: CredentialComponent,
): Promise<CredentialPlatformList> {
  return request<CredentialPlatformList>(`${credentialRoot(component)}/platform`);
}

export async function readCredential<C extends CredentialComponent>(
  component: C,
  credentialName: string,
): Promise<ComponentCredential[C]> {
  return request<ComponentCredential[C]>(credentialPath(component, credentialName));
}

export async function createCredential(
  component: CredentialComponent,
  body: CredentialCreateBody,
): Promise<Credential> {
  return request<Credential>(credentialRoot(component), {
    method: "POST",
    body,
    headers: { "idempotency-key": newUlid() },
  });
}

export async function checkCredential(
  component: CredentialComponent,
  body: CredentialCheckBody,
): Promise<HealthEntry> {
  return request<HealthEntry>(`${credentialRoot(component)}/check`, { method: "POST", body });
}

export async function verifyCredential(
  component: CredentialComponent,
  credentialName: string,
): Promise<HealthEntry> {
  return request<HealthEntry>(`${credentialPath(component, credentialName)}/verify`, {
    method: "POST",
  });
}

export async function rotateCredential(
  component: CredentialComponent,
  credentialName: string,
  body: CredentialRotateBody,
): Promise<Credential> {
  return request<Credential>(`${credentialPath(component, credentialName)}/revision`, {
    method: "POST",
    body,
    headers: { "idempotency-key": newUlid() },
  });
}

export async function updateCredentialMetadata(
  component: CredentialComponent,
  credentialName: string,
  body: CredentialMetadataBody,
): Promise<Credential> {
  return request<Credential>(`${credentialPath(component, credentialName)}/metadata`, {
    method: "PUT",
    body,
    headers: { "idempotency-key": newUlid() },
  });
}

export async function revokeCredentialRevision(
  component: CredentialComponent,
  credentialName: string,
  revision: number,
): Promise<Credential> {
  return request<Credential>(
    `${credentialPath(component, credentialName)}/revision/${revision}/revoke`,
    {
      method: "POST",
      headers: { "idempotency-key": newUlid() },
    },
  );
}

export async function archiveCredential(
  component: CredentialComponent,
  credentialName: string,
): Promise<Credential> {
  return request<Credential>(`${credentialPath(component, credentialName)}/archive`, {
    method: "POST",
    headers: { "idempotency-key": newUlid() },
  });
}

export async function startCredentialLogin(
  body: CredentialLoginBody,
): Promise<CredentialLoginSession> {
  return request<CredentialLoginSession>(LOGIN_PATH, {
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
    `${LOGIN_PATH}/${encodeURIComponent(sessionId)}/code`,
    { method: "POST", body: { value }, headers: { "idempotency-key": newUlid() } },
  );
}

export async function readCredentialLoginStatus(sessionId: string): Promise<CredentialLoginStatus> {
  return request<CredentialLoginStatus>(`${LOGIN_PATH}/${encodeURIComponent(sessionId)}`);
}

export async function listAllCredentials(
  component: CredentialComponent,
): Promise<readonly Credential[]> {
  return readAllPages<Credential>(credentialRoot(component));
}

export async function listCredentials(
  component: CredentialComponent,
  platform: CredentialPlatform,
): Promise<readonly Credential[]> {
  return readAllPages<Credential>(credentialRoot(component), { platform });
}

export async function discoverSshAliases(): Promise<SshDiscoverResult> {
  return request<SshDiscoverResult>("/api/repository/credential/ssh/discover");
}
