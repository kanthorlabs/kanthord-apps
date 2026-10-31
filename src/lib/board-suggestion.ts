import type { MissionActor, MissionAssessment, MissionProposal } from "@/api/types";

import type { AttentionItem } from "./attention";
import type { BoardGate } from "./board-items";
import { counted } from "./counted";
import { type FixAttentionItem, fixTargetOf } from "./fix-attention";

export interface Suggestion {
  readonly text: string;
  readonly source: string;
}

export interface ProposalSource {
  readonly name: string;
  readonly reviewer: string | null;
}

const CLIENT_RULE_SOURCE = "Source: client rule";
const UNKNOWN_REVIEWER = "the reviewer";

function clientRule(text: string): Suggestion {
  return { text, source: CLIENT_RULE_SOURCE };
}

export function actorNameOf(actor: MissionActor): string {
  if (actor.kind === "human") return actor.name;
  if (actor.kind === "execution") return actor.name ?? actor.execution_id;
  return `${actor.service} service`;
}

export function proposalSourceOf(
  proposals: readonly MissionProposal[],
  assessment: MissionAssessment | null,
): ProposalSource | null {
  const [first] = proposals;
  if (first === undefined) return null;
  return {
    name: first.content.name,
    reviewer: assessment === null ? null : actorNameOf(assessment.actor),
  };
}

function fixSuggestionOf(item: FixAttentionItem): Suggestion {
  if (item.kind === "credential_refused") {
    return clientRule(
      `Rotate ${item.credential}, then resume the ${counted(item.count, "paused node", "paused nodes")}. A resume before the rotation spends the extra try.`,
    );
  }
  if (item.kind === "environment_failed") {
    return clientRule(
      `Fix the failed command in the repository of binding ${item.binding}. A new base commit starts a new proof. A new onboarding at the same commit fails again.`,
    );
  }
  return clientRule(`${fixTargetOf(item).label}, then fix the setup that the cause names.`);
}

function pausedSuggestionOf(gate: BoardGate | null): Suggestion {
  if (gate === null) return clientRule("Resume the node. The next execution starts a new try.");
  return clientRule(`${gate.need} first. A resume before that fix spends the extra try.`);
}

function blockedSuggestionOf(proposal: ProposalSource | null): Suggestion {
  if (proposal === null) {
    return clientRule(
      "Unblock from the node branch. The next attempt reads this outcome and its cause.",
    );
  }
  return {
    text: `Decide the proposals: check "${proposal.name}".`,
    source: `Source: proposal of ${proposal.reviewer ?? UNKNOWN_REVIEWER}`,
  };
}

export function suggestionOf(
  item: AttentionItem,
  gate: BoardGate | null,
  proposal: ProposalSource | null = null,
): Suggestion {
  switch (item.kind) {
    case "paused":
      return pausedSuggestionOf(gate);
    case "blocked":
      return blockedSuggestionOf(proposal);
    case "dependency_discarded":
      return clientRule(
        `Does the work of ${item.discarded.map((dependency) => dependency.name).join(", ")} still need to happen? No: remove the dependency. Yes: add a new node for that work, then remove the dependency.`,
      );
    case "merge_wait":
    case "delivery_unconfirmed":
      return clientRule("Merge the pull request on the platform, then Check now.");
    case "tool_approval":
      return clientRule(
        "Approve if the change states what you want. Reject to return the call to the agent.",
      );
    default:
      return fixSuggestionOf(item);
  }
}
