import { useResource, type Resource } from "@/hooks/use-resource";
import { readBindings, type BindingReads } from "./settled-read";

export function useBindingRecords(
  projectId: string,
  bindingIds: readonly string[],
): Resource<BindingReads> {
  return useResource(() => readBindings(projectId, bindingIds), [projectId, bindingIds]);
}
