import type { HealthEntry, ResourceFailureReason } from "@/api/types";

const HINTS: Readonly<Record<ResourceFailureReason, string>> = {
  host_key_unknown:
    "The server does not know the host key of the repository host. Confirm the host key on the server. Then verify again.",
  key_refused:
    "The repository host refused the SSH key. Add the public key of the SSH credential to the repository as a deploy key with write access. Then verify again.",
  repository_not_found:
    "The repository host does not find the repository. Check the owner and the name in the address. A deploy key of another repository also gives this result.",
  host_unreachable:
    "The server cannot reach the repository host. Check the host in the address and the network of the server.",
  address_invalid:
    "The address is not valid, or its host is not a host of the platform. Use the form git@<host>:<owner>/<repository>.git.",
  unclassified:
    "The check failed for an unknown cause, or it exceeded its deadline. Verify again. If the failure stays, read the server log.",
};

function isKnownReason(reason: string): reason is ResourceFailureReason {
  return Object.hasOwn(HINTS, reason);
}

export function failureReasonHint(reason: string): string {
  if (isKnownReason(reason)) return HINTS[reason];
  return `The check failed with the reason ${reason}. Verify again. If the failure stays, read the server log.`;
}

export function failureReasonHintOf(details: unknown): string | null {
  if (typeof details !== "object" || details === null) return null;
  const reason: unknown = (details as Readonly<Record<string, unknown>>)["failure_reason"];
  return typeof reason === "string" ? failureReasonHint(reason) : null;
}

export function healthEntryHint(entry: HealthEntry): string | null {
  return entry.failure_reason === null ? null : failureReasonHint(entry.failure_reason);
}
