import { useCallback } from "react";

import { listProjects, listWorkerBindings } from "@/api/resources/projects";
import { readWorkerInstance } from "@/api/resources/worker-instances";
import type {
  CredentialPlatformEntry,
  InstanceCredentialCopy,
  Project,
  SecretShape,
  WorkerBindingRecord,
  WorkerInstanceDetail,
  WorkerRegistrationRecord,
} from "@/api/types";
import { useCredentialPlatforms } from "@/features/credentials/use-credential-platforms";
import { useInstanceExecutions, type InstanceExecution } from "@/hooks/use-instance-executions";
import { useResource, type Resource } from "@/hooks/use-resource";

export type InstanceBindingState = "serving" | "draining";

export interface InstanceBindingRow {
  readonly projectId: string;
  readonly projectName: string;
  readonly binding: string;
  readonly state: InstanceBindingState;
}

export interface InstanceRegistrationRow {
  readonly registration: WorkerRegistrationRecord;
  readonly execution: InstanceExecution | null;
}

export interface InstanceCredentialRow {
  readonly copy: InstanceCredentialCopy;
  readonly shape: SecretShape | null;
}

export interface InstanceContext {
  readonly projects: readonly Project[];
  readonly workerBindings: readonly WorkerBindingRecord[];
}

export interface InstancePage {
  readonly instance: Resource<WorkerInstanceDetail>;
  readonly bindingRows: readonly InstanceBindingRow[];
  readonly registrationRows: readonly InstanceRegistrationRow[];
  readonly credentialRows: readonly InstanceCredentialRow[];
  readonly contextError: string | null;
  readonly retryContext: () => void;
  readonly servedProjects: readonly string[];
  readonly projectNameOf: (projectId: string) => string;
}

async function readContext(detail: WorkerInstanceDetail | null): Promise<InstanceContext> {
  if (detail === null) return { projects: [], workerBindings: [] };
  const projectIds = [
    ...new Set([
      ...detail.bindings.map((binding) => binding.project_id),
      ...detail.registrations.map((registration) => registration.project_id),
    ]),
  ];
  const [projects, bindings] = await Promise.all([
    listProjects(),
    Promise.all(projectIds.map((id) => listWorkerBindings(id))),
  ]);
  return { projects, workerBindings: bindings.flat() };
}

export function bindingRowsOf(
  detail: WorkerInstanceDetail,
  context: InstanceContext,
): readonly InstanceBindingRow[] {
  const nameOf = (projectId: string) =>
    context.projects.find((project) => project.id === projectId)?.name ?? projectId;
  const serving = detail.bindings.map((binding) => ({
    projectId: binding.project_id,
    projectName: nameOf(binding.project_id),
    binding: binding.binding,
    state: "serving" as const,
  }));
  const draining = detail.registrations.flatMap((registration) => {
    const binding = context.workerBindings.find(
      (item) =>
        item.project_id === registration.project_id &&
        item.resource_identity === registration.resource_identity,
    );
    if (binding === undefined) return [];
    const listed = serving.some(
      (row) => row.projectId === registration.project_id && row.binding === binding.name,
    );
    if (listed) return [];
    return [
      {
        projectId: registration.project_id,
        projectName: nameOf(registration.project_id),
        binding: binding.name,
        state: "draining" as const,
      },
    ];
  });
  return [...serving, ...draining];
}

export function registrationRowsOf(
  registrations: readonly WorkerRegistrationRecord[],
  executions: readonly InstanceExecution[],
): readonly InstanceRegistrationRow[] {
  return registrations.map((registration) => ({
    registration,
    execution:
      executions.find((item) => item.runtimeIdentity === registration.runtime_identity) ?? null,
  }));
}

export function credentialRowsOf(
  copies: readonly InstanceCredentialCopy[],
  platforms: readonly CredentialPlatformEntry[] | null,
): readonly InstanceCredentialRow[] {
  return copies.map((copy) => ({
    copy,
    shape: platforms?.find((entry) => entry.platform === copy.platform)?.secret_shape ?? null,
  }));
}

export function useInstancePage(instanceName: string): InstancePage {
  const instance = useResource(() => readWorkerInstance(instanceName), [instanceName]);
  const context = useResource(() => readContext(instance.data), [instance.data]);
  const executions = useInstanceExecutions(instance.data?.registrations ?? null);
  const platforms = useCredentialPlatforms("llm");
  const detail = instance.data;
  const known = context.data ?? { projects: [], workerBindings: [] };
  const projectNameOf = (projectId: string) =>
    known.projects.find((project) => project.id === projectId)?.name ?? projectId;
  const servedProjects =
    detail === null
      ? []
      : [...new Set(detail.bindings.map((binding) => binding.project_id))].map(projectNameOf);
  const failure = context.error ?? platforms.error;
  const reloadContext = context.reload;
  const reloadPlatforms = platforms.reload;
  const retryContext = useCallback(() => {
    reloadContext();
    reloadPlatforms();
  }, [reloadContext, reloadPlatforms]);
  return {
    instance,
    bindingRows: detail === null ? [] : bindingRowsOf(detail, known),
    registrationRows: registrationRowsOf(detail?.registrations ?? [], executions),
    credentialRows: credentialRowsOf(detail?.credentials ?? [], platforms.data?.items ?? null),
    contextError: failure?.message ?? null,
    retryContext,
    servedProjects,
    projectNameOf,
  };
}
