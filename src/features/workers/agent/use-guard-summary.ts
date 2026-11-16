import { readGuardTask } from "@/api/resources/workers";
import { type AgentDeclaration, GuardTask } from "@/api/types";
import { type Resource, useResource } from "@/hooks/use-resource";

export function useGuardSummary(): Resource<AgentDeclaration> {
  return useResource(() => readGuardTask(GuardTask.Summary), []);
}
