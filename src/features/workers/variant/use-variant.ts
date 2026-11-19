import { readAgentVariant, readAgentVariantPrompt } from "@/api/resources/agent";
import { ApiError } from "@/api/errors";
import type { AgentDeclaration, AgentVariant } from "@/api/types";
import { type Resource, useResource } from "@/hooks/use-resource";
import { VARIANT_NOT_FOUND } from "@/lib/agent-variant";

export interface VariantRead {
  readonly variant: AgentVariant;
  readonly declaration: AgentDeclaration;
}

async function readVariantPage(agentName: string, variantId: string): Promise<VariantRead> {
  const variant = await readAgentVariant(variantId);
  if (variant.agent_name !== agentName) {
    throw new ApiError(
      "not_found",
      "The variant does not belong to this agent.",
      404,
      VARIANT_NOT_FOUND,
    );
  }
  return { variant, declaration: await readAgentVariantPrompt(agentName, variantId) };
}

export function useVariant(agentName: string, variantId: string): Resource<VariantRead> {
  return useResource(() => readVariantPage(agentName, variantId), [agentName, variantId]);
}
