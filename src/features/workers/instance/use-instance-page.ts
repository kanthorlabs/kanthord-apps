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
import { type InstanceExecution, useInstanceExecutions } from "@/hooks/use-instance-executions";
import { usePolledResource } from "@/hooks/use-polled-resource";
import { type Resource, useResource } from "@/hooks/use-resource";
import { OPENAI_COMPATIBLE } from "@/lib/credential-draft";
import { type HealthBadgeVariant, healthLabel, healthVariant } from "@/lib/credential-health";
import { instanceCopyHint } from "@/lib/failure-reason";
import { useWorkersProjectId } from "../use-workers-project-id";

const INSTANCE_INTERVAL_MS = 15_000;

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

export interface InstanceCopyHealthLine {
  readonly label: string;
  readonly variant: HealthBadgeVariant;
  readonly hint: string | null;
  readonly reportedAt: number | null;
}

export interface InstanceCredentialRow {
  readonly copy: InstanceCredentialCopy;
  readonly entry: CredentialPlatformEntry | null;
  readonly shape: SecretShape | null;
  readonly health: InstanceCopyHealthLine | null;
  readonly reportedModelIds: readonly string[];
  readonly modelsEditable: boolean;
}

export interface InstanceContext {
  readonly projects: readonly Project[];
  readonly workerBindings: readonly WorkerBindingRecord[];
}

export interface InstancePage {
  readonly projectId: string;
  readonly instance: Resource<WorkerInstanceDetail>;
  readonly bindingRows: readonly InstanceBindingRow[];
  readonly registrationRows: readonly InstanceRegistrationRow[];
  readonly credentialRows: readonly InstanceCredentialRow[];
  readonly contextError: string | null;
  readonly retryContext: () => void;
  readonly servedProjects: readonly string[];
  readonly keyed: boolean;
  readonly unlisted: boolean;
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

export function isKeyedInstance(detail: WorkerInstanceDetail): boolean {
  return detail.placement === "worker";
}

export function isUnlistedInstance(detail: WorkerInstanceDetail): boolean {
  return detail.placement !== "worker" && detail.bindings.length === 0;
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

export function copyHealthLineOf(copy: InstanceCredentialCopy): InstanceCopyHealthLine {
  const health = copy.health;
  const reported = health.reported_at !== null;
  return {
    label: healthLabel(health),
    variant: healthVariant(health),
    hint:
      reported && health.failure_reason !== null ? instanceCopyHint(health.failure_reason) : null,
    reportedAt: health.reported_at,
  };
}

export function credentialRowsOf(
  copies: readonly InstanceCredentialCopy[],
  platforms: readonly CredentialPlatformEntry[] | null,
): readonly InstanceCredentialRow[] {
  return copies.map((copy) => {
    const entry = platforms?.find((item) => item.platform === copy.platform) ?? null;
    return {
      copy,
      entry,
      shape: entry?.secret_shape ?? null,
      health: copy.sealed_current ? copyHealthLineOf(copy) : null,
      reportedModelIds: copy.health.models?.map((model) => model.id) ?? [],
      modelsEditable: entry !== null && copy.sealed_current && copy.platform === OPENAI_COMPATIBLE,
    };
  });
}

export function useInstancePage(instanceName: string): InstancePage {
  const projectId = useWorkersProjectId();
  const polled = usePolledResource(() => readWorkerInstance(instanceName), [instanceName], {
    intervalMs: INSTANCE_INTERVAL_MS,
  });
  const instance: Resource<WorkerInstanceDetail> = { ...polled, reload: polled.refresh };
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
    projectId,
    instance,
    bindingRows: detail === null ? [] : bindingRowsOf(detail, known),
    registrationRows: registrationRowsOf(detail?.registrations ?? [], executions),
    credentialRows: credentialRowsOf(detail?.credentials ?? [], platforms.data?.items ?? null),
    contextError: failure?.message ?? null,
    retryContext,
    servedProjects,
    keyed: detail === null ? false : isKeyedInstance(detail),
    unlisted: detail === null ? false : isUnlistedInstance(detail),
    projectNameOf,
  };
}
