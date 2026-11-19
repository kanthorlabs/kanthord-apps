import { useCallback, useState } from "react";

import { createAgentVariant } from "@/api/resources/agent";
import type { AgentVariant } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";
import { variantDraftFailureOf, type VariantFailure, variantFailureOf } from "@/lib/agent-variant";

export interface VariantCreateState {
  readonly name: string;
  readonly instruction: string;
  readonly failure: VariantFailure | null;
  readonly pending: boolean;
  readonly setName: (value: string) => void;
  readonly setInstruction: (value: string) => void;
  readonly submit: () => Promise<void>;
}

export function useVariantCreate(
  agentName: string,
  onCreated: (variant: AgentVariant) => void,
): VariantCreateState {
  const [name, setNameValue] = useState("");
  const [instruction, setInstructionValue] = useState("");
  const [failure, setFailure] = useState<VariantFailure | null>(null);
  const [pending, setPending] = useState(false);

  const setName = useCallback((value: string) => {
    setNameValue(value);
    setFailure(null);
  }, []);

  const setInstruction = useCallback((value: string) => {
    setInstructionValue(value);
    setFailure(null);
  }, []);

  const submit = useCallback(async () => {
    const displayName = name.trim();
    const refused = variantDraftFailureOf(displayName, instruction);
    if (refused !== null) {
      setFailure(refused);
      return;
    }
    setPending(true);
    setFailure(null);
    try {
      onCreated(
        await createAgentVariant({
          agent_name: agentName,
          display_name: displayName,
          instruction,
        }),
      );
    } catch (cause) {
      setFailure(variantFailureOf(asApiError(cause)));
    } finally {
      setPending(false);
    }
  }, [agentName, instruction, name, onCreated]);

  return { name, instruction, failure, pending, setName, setInstruction, submit };
}
