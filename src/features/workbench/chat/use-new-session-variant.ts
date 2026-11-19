import { readAgentVariant } from "@/api/resources/agent";
import type { AgentVariant } from "@/api/types";
import { useResource } from "@/hooks/use-resource";
import { variantFailureOf, type VariantLine } from "@/lib/agent-variant";

export interface NewSessionVariantRead {
  readonly variant: AgentVariant | null;
  readonly failure: VariantLine | null;
}

export function useNewSessionVariant(variantId: string): NewSessionVariantRead {
  const { data, error } = useResource(() => readAgentVariant(variantId), [variantId]);
  return { variant: data, failure: error === null ? null : variantFailureOf(error).line };
}
