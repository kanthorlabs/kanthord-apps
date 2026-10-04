import { newUlid } from "@/lib/ulid";
import { request } from "../client";
import type {
  BindingSet,
  BindingSetEntry,
  BindingSetWriteResult,
  Page,
  Project,
  ProjectBindingRecord,
} from "../types";

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

export async function readBindingSet(projectId: string): Promise<BindingSet> {
  return request<BindingSet>(`/api/project/${encodeURIComponent(projectId)}/binding-set`);
}

export async function writeBindingSet(
  projectId: string,
  version: number,
  bindings: Readonly<Record<string, BindingSetEntry>>,
): Promise<BindingSetWriteResult> {
  return request<BindingSetWriteResult>(
    `/api/project/${encodeURIComponent(projectId)}/binding-set`,
    { method: "PUT", body: { version, bindings }, headers: { "idempotency-key": newUlid() } },
  );
}

export async function readBinding(
  projectId: string,
  bindingId: string,
): Promise<ProjectBindingRecord> {
  return request<ProjectBindingRecord>(
    `/api/project/${encodeURIComponent(projectId)}/binding/${encodeURIComponent(bindingId)}`,
  );
}
