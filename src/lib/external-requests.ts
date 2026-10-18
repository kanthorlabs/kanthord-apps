import type {
  MissionEvidence,
  MissionExternalAction,
  MissionNodeRecord,
  RepositoryActionName,
} from "@/api/types";

import type { OutsideAttentionItem } from "./attention";
import { isTerminal } from "./node-state";
import { relativeAge } from "./relative-age";

const ACTION_LABELS: Readonly<Record<RepositoryActionName, string>> = {
  pull_request: "pull request",
  merge_push: "push to the base branch",
};

export function hasOpenAttempt(node: MissionNodeRecord): boolean {
  return node.attempt > 0 && node.state !== "Blocked" && !isTerminal(node.state);
}

export function unresolvedRequestsOf(
  actions: readonly MissionExternalAction[],
): readonly MissionExternalAction[] {
  return actions.filter((action) => action.requested && action.resolution === "unresolved");
}

export function requestsClearOf(
  node: MissionNodeRecord,
  actions: readonly MissionExternalAction[] | null,
): boolean {
  if (!hasOpenAttempt(node)) return true;
  return actions !== null && unresolvedRequestsOf(actions).length === 0;
}

function isHumanMerge(action: MissionExternalAction): boolean {
  return action.action.action === "pull_request" && action.action.configuration.landing === "human";
}

export function humanMergeRequestOf(
  actions: readonly MissionExternalAction[],
): MissionExternalAction | null {
  return unresolvedRequestsOf(actions).find(isHumanMerge) ?? null;
}

export function deliveryRequestsOf(
  actions: readonly MissionExternalAction[],
): readonly MissionExternalAction[] {
  return unresolvedRequestsOf(actions).filter((action) => !isHumanMerge(action));
}

export function unresolvedRequestsText(
  attempt: number,
  unresolved: readonly MissionExternalAction[],
  resumable: boolean,
  waiting = "Override and discard wait",
): string {
  const [first] = unresolved;
  const resume = resumable ? " Resume the node." : "";
  if (unresolved.length === 1 && first !== undefined) {
    return `Attempt ${attempt} has an unresolved ${ACTION_LABELS[first.action.action]}. ${waiting} for its end state.${resume}`;
  }
  return `Attempt ${attempt} has ${unresolved.length} unresolved requests. ${waiting} for their end states.${resume}`;
}

export function readFailureText(
  attempt: number,
  message: string,
  withExecutions: boolean,
  waiting = "The controls wait for them.",
): string {
  const subject = withExecutions ? "executions or the external actions" : "external actions";
  return `The ${subject} of attempt ${attempt} could not be read: ${message.replace(/\.$/, "")}. ${waiting}`;
}

function pullRequestOf(
  evidence: MissionEvidence | null,
): { readonly number: number; readonly repository: string } | null {
  for (const asset of evidence?.assets ?? []) {
    if (asset.kind === "platform" && asset.address.kind === "pull_request") {
      return { number: asset.address.number, repository: asset.address.resource_identity };
    }
  }
  return null;
}

function repositoryLabel(resourceIdentity: string): string {
  const github = /^repository:github:(.+)$/.exec(resourceIdentity);
  return github?.[1] === undefined ? resourceIdentity : `github.com/${github[1]}`;
}

export function mergeWaitText(evidence: MissionEvidence | null): string {
  const request = pullRequestOf(evidence);
  const subject =
    request === null
      ? "A pull request"
      : `Pull request #${request.number} on ${repositoryLabel(request.repository)}`;
  return `${subject} waits for a merge. Merge it, then check.`;
}

export function deliveryText(
  action: MissionExternalAction,
  evidence: MissionEvidence,
  now: number,
): string {
  const age = relativeAge(evidence.created_at, now);
  const request = pullRequestOf(evidence);
  const done =
    action.action.action === "merge_push"
      ? `kanthord pushed to ${action.action.configuration.base_branch}`
      : `kanthord requested the merge of ${
          request === null ? "the pull request" : `pull request #${request.number}`
        }`;
  return `${done} ${age}, and no end state arrived. Check the delivery.`;
}

export function causeSentenceOf(item: OutsideAttentionItem, now: number): string {
  if (item.kind === "merge_wait") return mergeWaitText(item.request.evidence);
  return item.request.evidence === null
    ? "No end state arrived. Check the delivery."
    : deliveryText(item.request.action, item.request.evidence, now);
}
