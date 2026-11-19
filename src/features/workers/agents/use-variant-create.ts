import { useCallback, useState } from "react";

import { createAgentVariant } from "@/api/resources/agent";
import type { AgentVariant } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";
import {
  VARIANT_NAME_RULE,
  type VariantFailure,
  variantFailureOf,
  variantNameValid,
} from "@/lib/agent-variant";

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
    if (!variantNameValid(displayName)) {
      setFailure({ field: "name", line: { code: null, message: VARIANT_NAME_RULE } });
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
