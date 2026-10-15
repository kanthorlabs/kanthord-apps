import type { MissionExternalAction, RepositoryActionName } from "@/api/types";

const ACTION_LABELS: Readonly<Record<RepositoryActionName, string>> = {
  pull_request: "pull request",
  merge_push: "push to the base branch",
};

export function unresolvedRequestsOf(
  actions: readonly MissionExternalAction[],
): readonly MissionExternalAction[] {
  return actions.filter((action) => action.requested && action.resolution === "unresolved");
}

export function unresolvedRequestsText(
  attempt: number,
  unresolved: readonly MissionExternalAction[],
): string {
  const [first] = unresolved;
  const resume = "Resume the node.";
  if (unresolved.length === 1 && first !== undefined) {
    return `Attempt ${attempt} has an unresolved ${ACTION_LABELS[first.action.action]}. Override and discard wait for its end state. ${resume}`;
  }
  return `Attempt ${attempt} has ${unresolved.length} unresolved requests. Override and discard wait for their end states. ${resume}`;
}
