import { isLoopbackUrl } from "@/lib/loopback-url";
import { newUlid } from "@/lib/ulid";
import { connectionBaseUrl, request } from "../client";
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
  HostKey,
  HostKeyPinBody,
  HostKeyScan,
  Page,
  SshKeyCreateBody,
  SshKeyRotateBody,
} from "../types";

const LOGIN_PATH = "/api/llm/credential/login";
const HOST_KEY_PATH = "/api/repository/host-key";

function credentialRoot(component: CredentialComponent): string {
  return `/api/${component}/credential`;
}

function credentialPath(component: CredentialComponent, credentialName: string): string {
  return `${credentialRoot(component)}/${encodeURIComponent(credentialName)}`;
}

function holderSuffix(holder: string | null): string {
  return holder === null ? "" : `?${new URLSearchParams({ holder })}`;
}

export async function listCredentialPage(
  component: CredentialComponent,
  platform: CredentialPlatform | null,
  cursor: string | null,
  includeArchived = false,
  holder: string | null = null,
): Promise<Page<Credential>> {
  const query = new URLSearchParams();
  if (holder !== null) query.set("holder", holder);
  if (platform !== null) query.set("platform", platform);
  if (includeArchived) query.set("include_archived", "true");
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
  holder: string | null = null,
): Promise<ComponentCredential[C]> {
  return request<ComponentCredential[C]>(
    `${credentialPath(component, credentialName)}${holderSuffix(holder)}`,
  );
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
  holder: string | null = null,
): Promise<Credential> {
  return request<Credential>(
    `${credentialPath(component, credentialName)}/revision${holderSuffix(holder)}`,
    { method: "POST", body, headers: { "idempotency-key": newUlid() } },
  );
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

export function browserLoginAvailable(): boolean {
  const baseUrl = connectionBaseUrl();
  return baseUrl === null || isLoopbackUrl(baseUrl);
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
): Promise<{ readonly session_id: string }> {
  return request<{ readonly session_id: string }>(
    `${LOGIN_PATH}/${encodeURIComponent(sessionId)}/code`,
    { method: "POST", body: { value }, headers: { "idempotency-key": newUlid() } },
  );
}

export async function readCredentialLoginStatus(sessionId: string): Promise<CredentialLoginStatus> {
  return request<CredentialLoginStatus>(`${LOGIN_PATH}/${encodeURIComponent(sessionId)}`);
}

export async function listAllCredentials(
  component: CredentialComponent,
  holder: string | null = null,
): Promise<readonly Credential[]> {
  return readAllPages<Credential>(credentialRoot(component), holder === null ? {} : { holder });
}

export async function listCredentials(
  component: CredentialComponent,
  platform: CredentialPlatform,
): Promise<readonly Credential[]> {
  return readAllPages<Credential>(credentialRoot(component), { platform });
}

export async function createSshKey(body: SshKeyCreateBody): Promise<Credential> {
  return request<Credential>(`${credentialRoot("repository")}/ssh/key`, {
    method: "POST",
    body,
    headers: { "idempotency-key": newUlid() },
  });
}

export async function rotateSshKey(
  credentialName: string,
  body: SshKeyRotateBody,
): Promise<Credential> {
  return request<Credential>(`${credentialPath("repository", credentialName)}/ssh/key`, {
    method: "POST",
    body,
    headers: { "idempotency-key": newUlid() },
  });
}

export async function listHostKeys(): Promise<readonly HostKey[]> {
  return readAllPages<HostKey>(HOST_KEY_PATH);
}

export async function scanHostKey(host: string): Promise<HostKeyScan> {
  return request<HostKeyScan>(`${HOST_KEY_PATH}/scan`, { method: "POST", body: { host } });
}

export async function pinHostKey(host: string, body: HostKeyPinBody): Promise<HostKey> {
  return request<HostKey>(`${HOST_KEY_PATH}/${encodeURIComponent(host)}`, {
    method: "PUT",
    body,
    headers: { "idempotency-key": newUlid() },
  });
}
