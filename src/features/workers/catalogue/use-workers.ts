import { useMemo } from "react";

import type { ApiError } from "@/api/errors";
import { listBindings } from "@/api/resources/projects";
import { listInstances, listTemplates } from "@/api/resources/workers";
import type { Binding, WorkerInstance, WorkerTemplate } from "@/api/types";
import { useProjectId } from "@/features/projects/project-context";
import { useResource } from "@/hooks/use-resource";

export interface EffectiveEntry {
  readonly key: string;
  readonly value: string;
  readonly inherited: boolean;
}

export interface WorkerBindingView {
  readonly binding: Binding;
  readonly template: WorkerTemplate | undefined;
  readonly effectiveEntries: readonly EffectiveEntry[];
  readonly instances: readonly WorkerInstance[];
  readonly busyCount: number;
}

export interface WorkersData {
  readonly templates: readonly WorkerTemplate[];
  readonly bindingViews: readonly WorkerBindingView[];
  readonly templatesLoading: boolean;
  readonly templatesError: ApiError | null;
  readonly bindingsLoading: boolean;
  readonly bindingsError: ApiError | null;
  readonly instancesLoading: boolean;
  readonly instancesError: ApiError | null;
  readonly reloadTemplates: () => void;
  readonly reloadBindings: () => void;
  readonly reloadInstances: () => void;
}

function buildEffectiveEntries(
  template: WorkerTemplate | undefined,
  agentEntries: Readonly<Record<string, string>> | undefined,
): readonly EffectiveEntry[] {
  if (template === undefined) return [];
  const overrides = agentEntries ?? {};
  const defaults = template.defaultConfiguration;
  const allKeys = new Set([...Object.keys(defaults), ...Object.keys(overrides)]);
  return Array.from(allKeys).map((key) => {
    const overrideValue = overrides[key];
    if (overrideValue !== undefined) {
      return { key, value: overrideValue, inherited: false };
    }
    const defaultValue = defaults[key];
    return { key, value: defaultValue ?? "", inherited: true };
  });
}

export function useWorkers(): WorkersData {
  const projectId = useProjectId();

  const {
    data: templates,
    loading: templatesLoading,
    error: templatesError,
    reload: reloadTemplates,
  } = useResource(() => listTemplates(), []);

  const {
    data: allBindings,
    loading: bindingsLoading,
    error: bindingsError,
    reload: reloadBindings,
  } = useResource(() => listBindings(projectId), [projectId]);

  const {
    data: instances,
    loading: instancesLoading,
    error: instancesError,
    reload: reloadInstances,
  } = useResource(() => listInstances(projectId), [projectId]);

  const bindingViews = useMemo<readonly WorkerBindingView[]>(() => {
    const workerBindings = (allBindings ?? []).filter((b) => b.kind === "worker");
    const templateMap = new Map((templates ?? []).map((t) => [t.name, t]));
    const instancesByBinding = new Map<string, WorkerInstance[]>();
    for (const inst of instances ?? []) {
      const existing = instancesByBinding.get(inst.bindingId) ?? [];
      existing.push(inst);
      instancesByBinding.set(inst.bindingId, existing);
    }
    return workerBindings.map((binding) => {
      const template =
        binding.workerName !== undefined ? templateMap.get(binding.workerName) : undefined;
      const bindingInstances = instancesByBinding.get(binding.id) ?? [];
      return {
        binding,
        template,
        effectiveEntries: buildEffectiveEntries(template, binding.agentEntries),
        instances: bindingInstances,
        busyCount: bindingInstances.filter((i) => i.busy).length,
      };
    });
  }, [templates, allBindings, instances]);

  return {
    templates: templates ?? [],
    bindingViews,
    templatesLoading,
    templatesError,
    bindingsLoading,
    bindingsError,
    instancesLoading,
    instancesError,
    reloadTemplates,
    reloadBindings,
    reloadInstances,
  };
}
