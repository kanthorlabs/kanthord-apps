import { useCallback, useState } from "react";

import { deleteAgentVariant } from "@/api/resources/agent";
import { asApiError } from "@/hooks/use-resource";
import {
  IN_USE_LINE,
  VARIANT_IN_USE,
  variantFailureOf,
  type VariantLine,
} from "@/lib/agent-variant";

export interface VariantDeleteState {
  readonly open: boolean;
  readonly pending: boolean;
  readonly failure: VariantLine | null;
  readonly request: () => void;
  readonly cancel: () => void;
  readonly confirm: () => Promise<void>;
}

export function useVariantDelete(
  variantId: string,
  revision: number,
  onDeleted: () => void,
): VariantDeleteState {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<VariantLine | null>(null);

  const request = useCallback(() => {
    setFailure(null);
    setOpen(true);
  }, []);

  const cancel = useCallback(() => {
    setOpen(false);
    setFailure(null);
  }, []);

  const confirm = useCallback(async () => {
    setPending(true);
    setFailure(null);
    try {
      await deleteAgentVariant(variantId, revision);
      setOpen(false);
      onDeleted();
    } catch (cause) {
      const error = asApiError(cause);
      setFailure(
        error.detail === VARIANT_IN_USE
          ? { code: VARIANT_IN_USE, message: IN_USE_LINE }
          : variantFailureOf(error).line,
      );
    } finally {
      setPending(false);
    }
  }, [onDeleted, revision, variantId]);

  return { open, pending, failure, request, cancel, confirm };
}
