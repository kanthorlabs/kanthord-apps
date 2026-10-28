import { listAgentCooldowns } from "@/api/resources/workers";
import type { AgentCooldown } from "@/api/types";
import { type Resource, useResource } from "@/hooks/use-resource";

export interface CredentialCooldown {
  readonly hold: AgentCooldown;
  readonly live: boolean;
}

async function readCooldown(credentialName: string): Promise<CredentialCooldown | null> {
  const cooldowns = await listAgentCooldowns();
  const hold = cooldowns.find((cooldown) => cooldown.credential === credentialName);
  return hold === undefined ? null : { hold, live: hold.available_at > Date.now() };
}

export function useCredentialCooldown(credentialName: string): Resource<CredentialCooldown | null> {
  return useResource(() => readCooldown(credentialName), [credentialName]);
}
