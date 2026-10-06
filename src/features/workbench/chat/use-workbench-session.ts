import { readWorkbenchSession } from "@/api/resources/workbench";
import type { WorkbenchSession } from "@/api/types";
import { useResource, type Resource } from "@/hooks/use-resource";

export function useWorkbenchSession(sessionId: string): Resource<WorkbenchSession> {
  return useResource(() => readWorkbenchSession(sessionId), [sessionId]);
}
