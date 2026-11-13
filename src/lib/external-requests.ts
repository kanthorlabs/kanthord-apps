import type { MissionExternalAction, MissionNodeRecord, RepositoryActionName } from "@/api/types";

import { isTerminal } from "./node-state";

const ACTION_LABELS: Readonly<Record<RepositoryActionName, string>> = {
  pull_request: "pull request",
  push: "push to the base branch",
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
