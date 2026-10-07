import type {
  ClaimState,
  MissionActor,
  MissionAssessmentResult,
  MissionClosingEvent,
  MissionEvidenceAsset,
  MissionExternalAction,
  MissionVerification,
} from "@/api/types";

import type { StateBadgeVariant } from "./node-state";

const CLOSING_EVENTS: Record<MissionClosingEvent, string> = {
  "success-override": "A human override asserted success.",
  "human-discard": "A human discarded the node.",
  "human-block": "A human blocked the node.",
  "assessment-not-passed": "A current assessment did not pass.",
  "external-failed": "A requested external action ended in another state.",
  "assessment-passed": "A current assessment passed.",
  "external-success": "Every requested external action reached its expected end state.",
};

const RESULT_VARIANTS: Record<MissionAssessmentResult, StateBadgeVariant> = {
  success: "secondary",
  "criterion-not-met": "destructive",
  undetermined: "outline",
};

const CLAIM_VARIANTS: Record<ClaimState, StateBadgeVariant> = {
  running: "default",
  finished: "secondary",
  lost: "destructive",
};

const RESOLUTION_VARIANTS: Record<MissionExternalAction["resolution"], StateBadgeVariant> = {
  unrequested: "outline",
  unresolved: "outline",
  "expected-end": "secondary",
  "other-end": "destructive",
};

export function closingEventText(event: MissionClosingEvent): string {
  return CLOSING_EVENTS[event];
}

export function resultVariant(result: MissionAssessmentResult): StateBadgeVariant {
  return RESULT_VARIANTS[result];
}

export function claimStateVariant(state: ClaimState): StateBadgeVariant {
  return CLAIM_VARIANTS[state];
}

export function resolutionVariant(
  resolution: MissionExternalAction["resolution"],
): StateBadgeVariant {
  return RESOLUTION_VARIANTS[resolution];
}

export function actorText(actor: MissionActor): string {
  if (actor.kind === "human") return `${actor.name} (${actor.account})`;
  if (actor.kind === "execution") {
    return actor.name === null ? actor.execution_id : `${actor.name} (${actor.execution_id})`;
  }
  const event = actor.inbound_event_id === undefined ? "" : ` (${actor.inbound_event_id})`;
  return `${actor.service} service${event}`;
}

function shortCommit(commit: string): string {
  return commit.slice(0, 12);
}

export function assetText(asset: MissionEvidenceAsset): string {
  if (asset.kind === "repository") {
    return `commit ${shortCommit(asset.address.commit)} on binding ${asset.address.binding_id}`;
  }
  if (asset.kind === "produced")
    return `produced content sha256 ${shortCommit(asset.address.sha256)}`;
  if (asset.kind === "object") return `object ${asset.address.location}, ${asset.size} bytes`;
  const address = asset.address;
  if (address.kind === "pull_request") {
    return `pull request #${address.number} on ${address.resource_identity}`;
  }
  return `push of ${shortCommit(address.commit)} to ${address.branch} on ${address.resource_identity}`;
}

export type VerificationResult = MissionVerification["results"][number];

export function verificationResultText(result: VerificationResult): string {
  if (result.timed_out) return "timed out";
  if (result.signal !== null) return `ended by ${result.signal}`;
  if (result.exit_code === null) return "did not run";
  return result.exit_code === 0 ? "passed" : `failed with exit code ${result.exit_code}`;
}

export function verificationPasses(verification: MissionVerification): boolean {
  return verification.results.every((result) => result.exit_code === 0);
}
