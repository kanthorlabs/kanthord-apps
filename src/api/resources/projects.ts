import { request } from "../client";
import type { Binding, Overview, PermittedClientIdentity, Project } from "../types";

export async function listProjects(): Promise<readonly Project[]> {
  return request<readonly Project[]>("/v1/projects");
}

export async function readOverview(projectId: string): Promise<Overview> {
  return request<Overview>(`/v1/projects/${projectId}/overview`);
}

export async function listBindings(projectId: string): Promise<readonly Binding[]> {
  return request<readonly Binding[]>(`/v1/projects/${projectId}/bindings`);
}

export async function setBindingAvailability(
  projectId: string,
  bindingId: string,
  available: boolean,
): Promise<Binding> {
  return request<Binding>(`/v1/projects/${projectId}/bindings/${bindingId}/availability`, {
    method: "PUT",
    body: { available },
  });
}

export async function setInstanceCount(
  projectId: string,
  bindingId: string,
  instanceCount: number,
): Promise<Binding> {
  return request<Binding>(`/v1/projects/${projectId}/bindings/${bindingId}/instance-count`, {
    method: "PUT",
    body: { instanceCount },
  });
}

export async function listClientIdentities(
  projectId: string,
): Promise<readonly PermittedClientIdentity[]> {
  return request<readonly PermittedClientIdentity[]>(`/v1/projects/${projectId}/client-identities`);
}

/** The daemon returns the client secret once and keeps its hash in custody. */
export async function rotateClientSecret(
  projectId: string,
  identityId: string,
): Promise<{ readonly clientSecret: string }> {
  return request<{ readonly clientSecret: string }>(
    `/v1/projects/${projectId}/client-identities/${identityId}/rotate`,
    { method: "POST" },
  );
}
