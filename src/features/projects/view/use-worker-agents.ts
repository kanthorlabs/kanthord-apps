import { listAgentEnablements, readWorkerCatalogEntry } from "@/api/resources/workers";
import type { AgentDefaultConfiguration, AgentProvider } from "@/api/types";
import { useResource, type Resource } from "@/hooks/use-resource";

export type WorkerAgentState = "enabled" | "disabled" | "absent";

export interface WorkerAgent {
  readonly agentName: string;
  readonly state: WorkerAgentState;
  readonly providers: readonly AgentProvider[];
  readonly defaults: AgentDefaultConfiguration | null;
}

export interface WorkerAgents {
  readonly external: boolean;
  readonly agents: readonly WorkerAgent[];
}

const NO_WORKER: WorkerAgents = { external: false, agents: [] };

async function readWorkerAgents(workerName: string): Promise<WorkerAgents> {
  if (workerName === "") return NO_WORKER;
  const [entry, enablements] = await Promise.all([
    readWorkerCatalogEntry(workerName),
    listAgentEnablements(),
  ]);
  if (entry.host !== "kanthord") return { external: true, agents: [] };
  return {
    external: false,
    agents: entry.agent_names.map((agentName) => {
      const enablement = enablements.find((item) => item.agent_name === agentName);
      return {
        agentName,
        state: enablement?.state ?? "absent",
        providers: enablement?.agent_providers ?? [],
        defaults: enablement?.default_configuration ?? null,
      };
    }),
  };
}

export function useWorkerAgents(workerName: string): Resource<WorkerAgents> {
  return useResource(() => readWorkerAgents(workerName), [workerName]);
}
