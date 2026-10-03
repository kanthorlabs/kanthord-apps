import type { NodeState } from "@/api/types";

export type StateBadgeVariant = "default" | "secondary" | "destructive" | "outline";

export type StateTone = "neutral" | "running" | "waiting" | "attention" | "good" | "dropped";

const TONES: Record<NodeState, StateTone> = {
  Pending: "neutral",
  Available: "waiting",
  Executing: "running",
  Waiting: "waiting",
  Evaluating: "running",
  Blocked: "attention",
  Paused: "neutral",
  Completed: "good",
  Discarded: "dropped",
  "External.Requested": "waiting",
  "External.Success": "good",
  "External.Failed": "attention",
};

const MEANINGS: Record<NodeState, string> = {
  Pending: "A node of the dependency closure is not Completed. No claim holds the node.",
  Available: "The closure holds and execution requires further work. No claim holds the node.",
  Executing: "A claimant holds the claim to execute the node's steps.",
  Waiting:
    "The execution of the open attempt requires no further work. The node waits for an evaluation claim.",
  Evaluating: "A reviewer execution holds the evaluation claim.",
  Blocked:
    "The attempt closed without success. A human unblock opens the next attempt or routes the node.",
  Paused: "A human paused the node. The live claim ends and an open attempt stays open.",
  Completed: "The node closes with a successful outcome. It satisfies a dependency. Terminal.",
  Discarded: "The node closes with an undetermined outcome. It satisfies no dependency. Terminal.",
  "External.Requested": "A requested external action has not reached its expected end state.",
  "External.Success": "Every requested external action reached its expected end state.",
  "External.Failed": "A requested external action ended in another state.",
};

const BADGE_VARIANTS: Record<StateTone, StateBadgeVariant> = {
  neutral: "outline",
  running: "default",
  waiting: "outline",
  attention: "destructive",
  good: "secondary",
  dropped: "outline",
};

export function toneOf(state: NodeState): StateTone {
  return TONES[state];
}

export function meaningOf(state: NodeState): string {
  return MEANINGS[state];
}

export function badgeVariantOf(state: NodeState): StateBadgeVariant {
  return BADGE_VARIANTS[TONES[state]];
}

export function isTerminal(state: NodeState): boolean {
  return state === "Completed" || state === "Discarded";
}
