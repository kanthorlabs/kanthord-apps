import { listBindingAgents, listWorkerBindings } from "@/api/resources/projects";
import { useResource, type Resource } from "@/hooks/use-resource";

export interface ChainCooling {
  readonly key: string;
  readonly agent: string;
  readonly binding: string;
  readonly availableAt: number;
}

const NO_COOLING: readonly ChainCooling[] = [];

async function readProjectCooling(projectId: string): Promise<readonly ChainCooling[]> {
  const now = Date.now();
  const bindings = (await listWorkerBindings(projectId)).filter(
    (binding) => binding.removed_at === null,
  );
  const reads = await Promise.all(
    bindings.map(async (binding) =>
      (await listBindingAgents(projectId, binding.id)).flatMap((view) =>
        view.cooling === null || view.cooling.available_at <= now
          ? []
          : [
              {
                key: `${binding.id}:${view.agent}`,
                agent: view.agent,
                binding: binding.name,
                availableAt: view.cooling.available_at,
              },
            ],
      ),
    ),
  );
  return reads.flat();
}

export function useProjectCooling(
  projectId: string,
  enabled: boolean,
): Resource<readonly ChainCooling[]> {
  return useResource(
    async () => (enabled ? readProjectCooling(projectId) : NO_COOLING),
    [projectId, enabled],
  );
}
