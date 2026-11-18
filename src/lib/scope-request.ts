import type { NodeState, ScopeRequest } from "@/api/types";

import { HOUR_MS, MINUTE_MS } from "./format";

export const UNAVAILABLE_REASON = "This request cannot be approved from this dashboard version.";

export const SAFER_PATH =
  "Reject keeps the project hidden. To share the project, revoke the invites and share a new conversation.";

export const SCOPE_REQUEST_HELPER =
  "Guests do not see these requests. Tell a guest about a request only when you mean to show that the record exists.";

const DAY_MS = 24 * HOUR_MS;
const NODE_KEYS = [
  "expected_state",
  "expected_attempt",
  "expected_revision",
  "blocked_attempt",
] as const;
const KNOWN_KEYS: readonly string[] = ["expected_mission_version", ...NODE_KEYS];

export interface ExpectedReads {
  readonly missionVersion: number | null;
  readonly node: {
    readonly state: NodeState;
    readonly attempt: number;
    readonly visible_revision: number;
  } | null;
}

export function expectedAvailable(keys: readonly string[], hasNode: boolean): boolean {
  return keys.every(
    (key) =>
      KNOWN_KEYS.includes(key) && (hasNode || !(NODE_KEYS as readonly string[]).includes(key)),
  );
}

export function expectedOf(
  keys: readonly string[],
  reads: ExpectedReads,
): Readonly<Record<string, number | string>> {
  const { missionVersion, node } = reads;
  const values: Readonly<Record<string, number | string | undefined>> = {
    expected_mission_version: missionVersion ?? undefined,
    expected_state: node?.state,
    expected_attempt: node?.attempt,
    expected_revision: node?.visible_revision,
    blocked_attempt: node?.attempt,
  };
  return Object.fromEntries(
    keys.map((key) => {
      const value = values[key];
      if (value === undefined) throw new Error(`The request key ${key} has no read value.`);
      return [key, value];
    }),
  );
}

export function requestedByLineOf(request: ScopeRequest): string {
  return `Requested in a run started by ${request.guest_name} (guest)`;
}

export function requestedLineOf(request: ScopeRequest): string {
  return `${requestedByLineOf(request)} · invite for ${request.invitee_name}`;
}

export interface ConsequencePart {
  readonly text: string;
  readonly bold: boolean;
}

export function consequenceOf(
  request: ScopeRequest,
  projectName: string,
): readonly ConsequencePart[] {
  return [
    {
      text: `This runs ${request.operation_id} on ${request.target_id} in project `,
      bold: false,
    },
    { text: projectName, bold: true },
    { text: ". ", bold: false },
    { text: projectName, bold: true },
    {
      text: ` is not shared in this conversation. ${request.guest_name} (guest) cannot see it. The act runs as your own act. Nothing about it enters this conversation. Anything that you or your own runs write here reaches every guest.`,
      bold: false,
    },
  ];
}

export function ageTextOf(createdAt: number, now: number): string {
  const age = Math.max(0, now - createdAt);
  if (age < HOUR_MS) return `${Math.floor(age / MINUTE_MS)} min`;
  if (age < DAY_MS) return `${Math.floor(age / HOUR_MS)} h`;
  return `${Math.floor(age / DAY_MS)} d`;
}

export function utcDateOf(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function requestAgeLineOf(request: ScopeRequest, now: number): string {
  return `Requested ${ageTextOf(request.created_at, now)} ago · ends with the invite on ${utcDateOf(request.expires_at)}`;
}
