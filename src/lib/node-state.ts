import type { NodeState } from "@/api/types";

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
  Waiting: "The execution of the open attempt requires no further work. Released, not claimable.",
  Evaluating: "A reviewer execution holds the claim.",
  Blocked: "The attempt closed on a condition. A human unblock authorizes the next attempt.",
  Paused: "A human holds the work temporarily. An open attempt stays open.",
  Completed: "The node closes with a successful outcome. Terminal.",
  Discarded: "The node closes with no successful outcome. Terminal.",
  "External.Requested": "A required external action has not reached its expected end state.",
  "External.Success": "Every required external action reached its expected end state.",
  "External.Failed": "A required external action ended in another state.",
};

const CLASSES: Record<StateTone, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  running:
    "border-sky-300 bg-sky-100 text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200",
  waiting:
    "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
  attention:
    "border-red-300 bg-red-100 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200",
  good: "border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  dropped: "border-border bg-background text-muted-foreground line-through",
};

export function toneOf(state: NodeState): StateTone {
  return TONES[state];
}

export function meaningOf(state: NodeState): string {
  return MEANINGS[state];
}

export function stateClasses(state: NodeState): string {
  return CLASSES[TONES[state]];
}

export function isTerminal(state: NodeState): boolean {
  return state === "Completed" || state === "Discarded";
}
