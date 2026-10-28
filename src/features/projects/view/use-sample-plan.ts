import { readBindingSet } from "@/api/resources/projects";
import { useResource } from "@/hooks/use-resource";
import { type SamplePlan, samplePlanOf } from "@/lib/mission-plan-sample";

export function useSamplePlan(projectId: string): SamplePlan {
  const bindingSet = useResource(() => readBindingSet(projectId), [projectId]);
  return samplePlanOf(bindingSet.data);
}
