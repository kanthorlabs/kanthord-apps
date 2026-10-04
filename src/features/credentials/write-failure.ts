import { asApiError } from "@/hooks/use-resource";
import { credentialMessage, REVISION_CONFLICT } from "./credential-message";

export interface WriteFailure {
  readonly message: string;
  readonly conflict: boolean;
}

export function writeFailureOf(cause: unknown): WriteFailure {
  const failure = asApiError(cause);
  return { message: credentialMessage(failure), conflict: failure.detail === REVISION_CONFLICT };
}
