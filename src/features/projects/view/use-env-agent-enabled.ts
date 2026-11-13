import { readAgentEnablement } from "@/api/resources/workers";
import { useResource } from "@/hooks/use-resource";

const PE_AGENT = "pe@1";

export function useEnvAgentEnabled(): boolean | null {
  const { data, error, loading } = useResource(() => readAgentEnablement(PE_AGENT), []);
  if (loading) return null;
  if (data !== null) return data.state === "enabled";
  return error?.code === "not_found" ? false : null;
}
