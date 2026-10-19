import type { CredentialComponent, HealthEntry, ResourceFailureReason } from "@/api/types";

type HttpFailureReason =
  "unauthorized" | "forbidden" | "rate_limited" | "unreachable" | "invalid_response";

type SharedFailureReason = Exclude<ResourceFailureReason, HttpFailureReason>;

const SHARED_HINTS: Readonly<Record<SharedFailureReason, string>> = {
  host_key_unknown:
    "Open the binding. The sheet pins the host key, or shows Confirm host key. Then verify again.",
  key_refused:
    "The repository host refused the SSH key. Add the public key of the SSH credential to the repository as a deploy key with write access. Then verify again.",
  repository_not_found:
    "The repository host does not find the repository. Check the owner and the name in the address. A deploy key of another repository also gives this result.",
  host_unreachable:
    "The server cannot reach the repository host. Check the host in the address and the network of the server.",
  address_invalid:
    "The address is not valid, or its host is not a host of the platform. Use the form git@<host>:<owner>/<repository>.git.",
  host_key_changed:
    "The host presented another key. Compare the fingerprint with the published one, then pin again.",
  identity_unavailable:
    "The server cannot load the SSH key. Rotate the key. If the fault stays, read the server log.",
  unclassified:
    "The check failed for an unknown cause, or it exceeded its deadline. Verify again. If the failure stays, read the server log.",
};

const LLM_HINTS: Readonly<Record<HttpFailureReason, string>> = {
  unauthorized:
    "The provider refused the API key or the access token. Correct the key, or sign in again for a new token. Then verify again.",
  forbidden:
    "The provider accepted the key or the token but refused the access. Check the permissions and the plan of the account.",
  rate_limited:
    "The provider limited the requests. Wait some minutes, or check the quota of the plan. Then verify again.",
  unreachable:
    "The server cannot reach the provider. Check the network of the server and the base URL of an openai-compatible credential. For an OAuth platform, sign in again.",
  invalid_response:
    "The provider sent an answer that the check does not expect, for example a server error. Verify again later. For an openai-compatible credential, check that the base URL points to the API of the provider.",
};

const REMOTE_HINTS: Readonly<Record<HttpFailureReason, string>> = {
  unauthorized:
    "The remote service refused the token or the access key. Correct the token or the key. Then verify again.",
  forbidden:
    "The remote service accepted the token or the key but refused the access. Check the permissions of the token or the key.",
  rate_limited:
    "The remote service limited the requests. Wait some minutes, or check the quota of the account. Then verify again.",
  unreachable:
    "The server cannot reach the remote service. Check the network of the server and the endpoint of a storage credential.",
  invalid_response:
    "The remote service sent an answer that the check does not expect, for example a server error. Verify again later. For a storage credential, check the endpoint and the bucket.",
};

const HTTP_HINTS: Readonly<
  Record<CredentialComponent, Readonly<Record<HttpFailureReason, string>>>
> = {
  llm: LLM_HINTS,
  repository: REMOTE_HINTS,
  storage: REMOTE_HINTS,
};

export function failureReasonHint(reason: string, component: CredentialComponent): string {
  const http = HTTP_HINTS[component];
  if (Object.hasOwn(http, reason)) return http[reason as HttpFailureReason];
  if (Object.hasOwn(SHARED_HINTS, reason)) return SHARED_HINTS[reason as SharedFailureReason];
  return `The check failed with the reason ${reason}. Verify again. If the failure stays, read the server log.`;
}

export function failureReasonHintOf(details: unknown): string | null {
  if (typeof details !== "object" || details === null) return null;
  const reason: unknown = (details as Readonly<Record<string, unknown>>)["failure_reason"];
  return typeof reason === "string" ? failureReasonHint(reason, "repository") : null;
}

export function healthEntryHint(entry: HealthEntry, component: CredentialComponent): string | null {
  return entry.failure_reason === null ? null : failureReasonHint(entry.failure_reason, component);
}
