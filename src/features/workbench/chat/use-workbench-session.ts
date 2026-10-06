import { readWorkbenchSession } from "@/api/resources/workbench";
import { readAgent } from "@/api/resources/workers";
import type { AgentEnablement, WorkbenchSession } from "@/api/types";
import { useResource, type Resource } from "@/hooks/use-resource";

export interface WorkbenchSessionView {
  readonly session: WorkbenchSession;
  readonly enablement: AgentEnablement | null;
}

export function useWorkbenchSession(sessionId: string): Resource<WorkbenchSessionView> {
  return useResource(async () => {
    const session = await readWorkbenchSession(sessionId);
    const agent = await readAgent(session.agentName).catch(() => null);
    return { session, enablement: agent?.enablement ?? null };
  }, [sessionId]);
}
