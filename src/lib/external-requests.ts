import type { MissionExternalAction, MissionRunnableNode, RepositoryActionName } from "@/api/types";

import { isTerminal } from "./node-state";

const ACTION_LABELS: Readonly<Record<RepositoryActionName, string>> = {
  pull_request: "pull request",
  merge_push: "push to the base branch",
};

export function hasOpenAttempt(node: MissionRunnableNode): boolean {
  return node.attempt > 0 && node.state !== "Blocked" && !isTerminal(node.state);
}

export function unresolvedRequestsOf(
  actions: readonly MissionExternalAction[],
): readonly MissionExternalAction[] {
  return actions.filter((action) => action.requested && action.resolution === "unresolved");
}

export function requestsClearOf(
  node: MissionRunnableNode,
  actions: readonly MissionExternalAction[] | null,
): boolean {
  if (!hasOpenAttempt(node)) return true;
  return actions !== null && unresolvedRequestsOf(actions).length === 0;
}

export function unresolvedRequestsText(
  attempt: number,
  unresolved: readonly MissionExternalAction[],
  resumable: boolean,
): string {
  const [first] = unresolved;
  const resume = resumable ? " Resume the node." : "";
  if (unresolved.length === 1 && first !== undefined) {
    return `Attempt ${attempt} has an unresolved ${ACTION_LABELS[first.action.action]}. Override and discard wait for its end state.${resume}`;
  }
  return `Attempt ${attempt} has ${unresolved.length} unresolved requests. Override and discard wait for their end states.${resume}`;
}

export function readFailureText(attempt: number, message: string, withExecutions: boolean): string {
  const subject = withExecutions ? "executions or the external actions" : "external actions";
  return `The ${subject} of attempt ${attempt} could not be read: ${message.replace(/\.$/, "")}. The controls wait for them.`;
}
