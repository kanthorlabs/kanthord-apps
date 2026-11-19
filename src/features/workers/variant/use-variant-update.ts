import { useCallback, useState } from "react";

import { updateAgentVariant } from "@/api/resources/agent";
import type { AgentVariant } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";
import {
  currentVariantOf,
  VARIANT_REVISION_CONFLICT,
  variantDraftFailureOf,
  type VariantFailure,
  variantFailureOf,
} from "@/lib/agent-variant";

export interface VariantUpdateState {
  readonly open: boolean;
  readonly name: string;
  readonly instruction: string;
  readonly failure: VariantFailure | null;
  readonly conflict: { readonly message: string; readonly current: AgentVariant } | null;
  readonly pending: boolean;
  readonly saved: boolean;
  readonly start: () => void;
  readonly cancel: () => void;
  readonly setName: (value: string) => void;
  readonly setInstruction: (value: string) => void;
  readonly submit: () => Promise<void>;
}

export function useVariantUpdate(variant: AgentVariant, onSaved: () => void): VariantUpdateState {
  const [open, setOpen] = useState(false);
  const [name, setNameValue] = useState(variant.display_name);
  const [instruction, setInstructionValue] = useState(variant.instruction);
  const [failure, setFailure] = useState<VariantFailure | null>(null);
  const [conflict, setConflict] = useState<VariantUpdateState["conflict"]>(null);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  const start = useCallback(() => {
    setNameValue(variant.display_name);
    setInstructionValue(variant.instruction);
    setFailure(null);
    setConflict(null);
    setSaved(false);
    setOpen(true);
  }, [variant.display_name, variant.instruction]);

  const cancel = useCallback(() => {
    setOpen(false);
    setFailure(null);
    setConflict(null);
  }, []);

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
      await updateAgentVariant(variant.id, {
        display_name: displayName,
        instruction,
        expected_revision: conflict?.current.revision ?? variant.revision,
      });
      setConflict(null);
      setSaved(true);
      setOpen(false);
      onSaved();
    } catch (cause) {
      const error = asApiError(cause);
      const current =
        error.detail === VARIANT_REVISION_CONFLICT ? currentVariantOf(error.details) : null;
      if (current === null) setFailure(variantFailureOf(error));
      else setConflict({ message: error.message, current });
    } finally {
      setPending(false);
    }
  }, [conflict, instruction, name, onSaved, variant.id, variant.revision]);

  return {
    open,
    name,
    instruction,
    failure,
    conflict,
    pending,
    saved,
    start,
    cancel,
    setName,
    setInstruction,
    submit,
  };
}
