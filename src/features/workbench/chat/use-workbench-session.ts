import { readWorkbenchSession } from "@/api/resources/workbench";
import { listAgents, readAgent } from "@/api/resources/workers";
import type { AgentEnablement, WorkbenchSession } from "@/api/types";
import { type Resource, useResource } from "@/hooks/use-resource";

export interface WorkbenchSessionView {
  readonly session: WorkbenchSession;
  readonly enablement: AgentEnablement | null;
  readonly agentDisplayName: string;
}

export function useWorkbenchSession(sessionId: string): Resource<WorkbenchSessionView> {
  return useResource(async () => {
    const session = await readWorkbenchSession(sessionId);
    const agent = await readAgent(session.agent_name).catch(() => null);
    const summaries = await listAgents();
    const agentDisplayName =
      summaries.find((summary) => summary.agentName === session.agent_name)?.displayName ??
      session.agent_name;
    return { session, enablement: agent?.enablement ?? null, agentDisplayName };
  }, [sessionId]);
}
