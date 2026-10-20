import { listAgentCooldowns } from "@/api/resources/workers";
import type { AgentCooldown } from "@/api/types";
import { useResource, type Resource } from "@/hooks/use-resource";

async function readLiveCooldown(credentialName: string): Promise<AgentCooldown | null> {
  const now = Date.now();
  const cooldowns = await listAgentCooldowns();
  return (
    cooldowns.find(
      (cooldown) => cooldown.credential === credentialName && cooldown.available_at > now,
    ) ?? null
  );
}

export function useCredentialCooldown(credentialName: string): Resource<AgentCooldown | null> {
  return useResource(() => readLiveCooldown(credentialName), [credentialName]);
}
