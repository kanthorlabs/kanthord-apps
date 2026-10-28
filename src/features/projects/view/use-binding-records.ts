import { type Resource, useResource } from "@/hooks/use-resource";
import { type BindingReads, readBindings } from "./settled-read";

export function useBindingRecords(
  projectId: string,
  bindingIds: readonly string[],
): Resource<BindingReads> {
  return useResource(() => readBindings(projectId, bindingIds), [projectId, bindingIds]);
}
