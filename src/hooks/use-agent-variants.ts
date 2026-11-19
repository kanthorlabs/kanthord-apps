import { listAgentVariants } from "@/api/resources/agent";
import type { AgentVariantItem } from "@/api/types";
import { type Resource, useResource } from "@/hooks/use-resource";

export function useAgentVariants(): Resource<readonly AgentVariantItem[]> {
  return useResource(() => listAgentVariants(), []);
}
