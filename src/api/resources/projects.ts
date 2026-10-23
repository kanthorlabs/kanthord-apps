import { newIdempotencyKey } from "@/lib/idempotency-key";
import { request } from "../client";
import { readAllPages } from "../pages";
import type {
  BindingAgentView,
  BindingEnvironment,
  BindingSet,
  BindingSetEntry,
  BindingSetWriteResult,
  BindingVerifyResult,
  EnvironmentDocument,
  EnvironmentList,
  EnvironmentState,
  InstructionFiles,
  Page,
  Project,
  ProjectBindingRecord,
  WorkerBindingRecord,
} from "../types";

const PROJECT_PAGE_LIMIT = 1000;
const BINDING_PAGE_LIMIT = 1000;

export async function listProjects(): Promise<readonly Project[]> {
  const projects: Project[] = [];
  let cursor: string | null = null;
  do {
    const query = new URLSearchParams({ limit: String(PROJECT_PAGE_LIMIT) });
    if (cursor !== null) query.set("cursor", cursor);
    const page: Page<Project> = await request<Page<Project>>(`/api/project?${query}`);
    projects.push(...page.items);
    cursor = page.next_cursor;
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
    headers: { "idempotency-key": newIdempotencyKey() },
  });
}

export async function renameProject(projectId: string, name: string): Promise<Project> {
  return request<Project>(`/api/project/${encodeURIComponent(projectId)}`, {
    method: "PATCH",
    body: { name },
    headers: { "idempotency-key": newIdempotencyKey() },
  });
}

export async function pauseProject(projectId: string): Promise<Project> {
  return request<Project>(`/api/project/${encodeURIComponent(projectId)}/pause`, {
    method: "POST",
    headers: { "idempotency-key": newIdempotencyKey() },
  });
}

export async function resumeProject(projectId: string): Promise<Project> {
  return request<Project>(`/api/project/${encodeURIComponent(projectId)}/resume`, {
    method: "POST",
    headers: { "idempotency-key": newIdempotencyKey() },
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
    {
      method: "PUT",
      body: { version, bindings },
      headers: { "idempotency-key": newIdempotencyKey() },
    },
  );
}

async function readBindingPages<T extends ProjectBindingRecord>(
  projectId: string,
  kind: T["kind"] | null,
): Promise<readonly T[]> {
  const bindings: T[] = [];
  let cursor: string | null = null;
  do {
    const query = new URLSearchParams({ limit: String(BINDING_PAGE_LIMIT) });
    if (kind !== null) query.set("kind", kind);
    if (cursor !== null) query.set("cursor", cursor);
    const page: Page<T> = await request<Page<T>>(
      `/api/project/${encodeURIComponent(projectId)}/binding?${query}`,
    );
    bindings.push(...page.items);
    cursor = page.next_cursor;
  } while (cursor !== null);
  return bindings;
}

export async function listBindings(projectId: string): Promise<readonly ProjectBindingRecord[]> {
  return readBindingPages<ProjectBindingRecord>(projectId, null);
}

export async function listWorkerBindings(
  projectId: string,
): Promise<readonly WorkerBindingRecord[]> {
  return readBindingPages<WorkerBindingRecord>(projectId, "worker");
}

export async function listBindingAgents(
  projectId: string,
  bindingId: string,
): Promise<readonly BindingAgentView[]> {
  return readAllPages<BindingAgentView>(
    `/api/project/${encodeURIComponent(projectId)}/binding/${encodeURIComponent(bindingId)}/agent`,
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

export async function verifyBinding(
  projectId: string,
  bindingId: string,
): Promise<BindingVerifyResult> {
  return request<BindingVerifyResult>(
    `/api/project/${encodeURIComponent(projectId)}/binding/${encodeURIComponent(bindingId)}/verify`,
    { method: "POST" },
  );
}

export async function readInstructionFiles(
  projectId: string,
  bindingId: string,
): Promise<InstructionFiles> {
  return request<InstructionFiles>(
    `/api/project/${encodeURIComponent(projectId)}/binding/${encodeURIComponent(bindingId)}/instruction_files`,
  );
}

export async function checkBinding(
  projectId: string,
  entry: BindingSetEntry,
): Promise<BindingVerifyResult> {
  return request<BindingVerifyResult>(
    `/api/project/${encodeURIComponent(projectId)}/binding/check`,
    { method: "POST", body: { kind: entry.kind, config: entry.config } },
  );
}

export async function listProjectEnvironments(
  projectId: string,
): Promise<readonly EnvironmentState[]> {
  const list = await request<EnvironmentList>(
    `/api/project/${encodeURIComponent(projectId)}/environment`,
  );
  return list.items;
}

export async function rebuildEnvironment(
  projectId: string,
  bindingId: string,
): Promise<EnvironmentState> {
  return request<EnvironmentState>(
    `/api/project/${encodeURIComponent(projectId)}/binding/${encodeURIComponent(bindingId)}/environment/rebuild`,
    { method: "POST", headers: { "idempotency-key": newIdempotencyKey() } },
  );
}

export async function readBindingEnvironment(
  projectId: string,
  bindingId: string,
): Promise<BindingEnvironment> {
  return request<BindingEnvironment>(
    `/api/project/${encodeURIComponent(projectId)}/binding/${encodeURIComponent(bindingId)}/environment`,
  );
}

export async function writeBindingEnvironment(
  projectId: string,
  bindingId: string,
  environment: EnvironmentDocument,
): Promise<BindingSetWriteResult> {
  return request<BindingSetWriteResult>(
    `/api/project/${encodeURIComponent(projectId)}/binding/${encodeURIComponent(bindingId)}/environment`,
    {
      method: "PUT",
      body: { environment },
      headers: { "idempotency-key": newIdempotencyKey() },
    },
  );
}
