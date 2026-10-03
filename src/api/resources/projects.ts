import { newUlid } from "@/lib/ulid";
import { request } from "../client";
import type { Binding, Overview, Page, PermittedClientIdentity, Project } from "../types";

const PROJECT_PAGE_LIMIT = 1000;

export async function listProjects(): Promise<readonly Project[]> {
  const projects: Project[] = [];
  let cursor: string | null = null;
  do {
    const query = new URLSearchParams({ limit: String(PROJECT_PAGE_LIMIT) });
    if (cursor !== null) query.set("cursor", cursor);
    const page: Page<Project> = await request<Page<Project>>(`/api/project?${query}`);
    projects.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor !== null);
  return projects;
}

export async function listProjectPage(cursor: string | null): Promise<Page<Project>> {
  const query = new URLSearchParams();
  if (cursor !== null) query.set("cursor", cursor);
  const suffix = query.size === 0 ? "" : `?${query}`;
  return request<Page<Project>>(`/api/project${suffix}`);
}

export async function readProject(projectId: string): Promise<Project> {
  return request<Project>(`/api/project/${encodeURIComponent(projectId)}`);
}

export async function createProject(name: string): Promise<Project> {
  return request<Project>("/api/project", {
    method: "POST",
    body: { name },
    headers: { "idempotency-key": newUlid() },
  });
}

export async function renameProject(projectId: string, name: string): Promise<Project> {
  return request<Project>(`/api/project/${encodeURIComponent(projectId)}`, {
    method: "PATCH",
    body: { name },
    headers: { "idempotency-key": newUlid() },
  });
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
