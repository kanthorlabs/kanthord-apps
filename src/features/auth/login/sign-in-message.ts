import { isApiError } from "@/api/errors";

export function signInMessage(cause: unknown): string {
  if (!isApiError(cause)) return "The sign in failed.";
  if (cause.code === "unauthorized") {
    return "The instance refused the token. Use a human token from kanthord jwt generate.";
  }
  if (cause.code === "unreachable") {
    return `The instance did not answer. Its configured origins may not include this dashboard origin, ${window.location.origin}.`;
  }
  return cause.message;
}
