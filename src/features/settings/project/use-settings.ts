import type { ApiError } from "@/api/errors";
import { listBindings, listClientIdentities } from "@/api/resources/projects";
import { useProjectId } from "@/features/projects/project-context";
import { useResource } from "@/hooks/use-resource";
import type { Binding, PermittedClientIdentity } from "@/api/types";

export interface SettingsData {
  readonly repositoryBindings: readonly Binding[];
  readonly workerBindings: readonly Binding[];
  readonly providerBindings: readonly Binding[];
  readonly sourceBindings: readonly Binding[];
  readonly clientIdentities: readonly PermittedClientIdentity[];
  readonly bindingsLoading: boolean;
  readonly bindingsError: ApiError | null;
  readonly identitiesLoading: boolean;
  readonly identitiesError: ApiError | null;
  readonly reloadBindings: () => void;
  readonly reloadIdentities: () => void;
}

export function useSettings(): SettingsData {
  const projectId = useProjectId();

  const {
    data: allBindings,
    loading: bindingsLoading,
    error: bindingsError,
    reload: reloadBindings,
  } = useResource(() => listBindings(projectId), [projectId]);

  const {
    data: identities,
    loading: identitiesLoading,
    error: identitiesError,
    reload: reloadIdentities,
  } = useResource(() => listClientIdentities(projectId), [projectId]);

  const bindings = allBindings ?? [];

  return {
    repositoryBindings: bindings.filter((b) => b.kind === "repository"),
    workerBindings: bindings.filter((b) => b.kind === "worker"),
    providerBindings: bindings.filter((b) => b.kind === "provider account"),
    sourceBindings: bindings.filter((b) => b.kind === "source"),
    clientIdentities: identities ?? [],
    bindingsLoading,
    bindingsError,
    identitiesLoading,
    identitiesError,
    reloadBindings,
    reloadIdentities,
  };
}
