import type { WorkbenchSessionListItem } from "@/api/types";
import type {
  AttentionItem,
  DecisionAttentionItem,
  FindingReviewItem,
  FollowupItem,
  OutsideAttentionItem,
} from "@/lib/attention";
import type { FixAttentionItem } from "@/lib/fix-attention";

export const CASE_REQUEST_PREFIX = "Case: ";

type NodeCaseItem = DecisionAttentionItem | FindingReviewItem | FollowupItem | OutsideAttentionItem;

type FixKind = FixAttentionItem["kind"];

interface FixAsk<K extends FixKind> {
  readonly subject: (item: Extract<FixAttentionItem, { kind: K }>) => string;
  readonly ask: string;
}

export const CASE_ASKS: Readonly<Record<NodeCaseItem["kind"], string>> = {
  blocked: "Explain why it is blocked and recommend how to unblock it.",
  paused: "Explain why it is paused and recommend whether to resume it.",
  dependency_discarded: "A dependency of it was discarded. Recommend how to continue.",
  finding_review: "Explain each open finding and recommend a decision.",
  followup_proposal: "Explain each follow-up proposal and recommend approve or reject.",
  merge_wait: "It waits for a human merge. Report what the merge needs.",
  delivery_unconfirmed: "Its delivery is not confirmed. Report what the confirmation needs.",
};

function firstBindingOf(item: Extract<FixAttentionItem, { kind: "agent_invalid" }>): string {
  const [first] = item.bindings;
  if (first === undefined) throw new Error(`agent_invalid item ${item.id} holds no binding`);
  return first.binding;
}

export const FIX_ASKS: { readonly [K in FixKind]: FixAsk<K> } = {
  project_paused: {
    subject: (item) => `project \`${item.project.id}\``,
    ask: "Explain why it is paused and recommend whether to resume it.",
  },
  environment_failed: {
    subject: (item) => `binding \`${item.binding}\` of project \`${item.project.id}\``,
    ask: "Explain why the environment failed and recommend the fix.",
  },
  environment_pending: {
    subject: (item) => `binding \`${item.binding}\` of project \`${item.project.id}\``,
    ask: "Explain what the environment waits for.",
  },
  no_taker: {
    subject: (item) =>
      `jobs in state ${item.state} (${item.jobCount}) of project \`${item.project.id}\``,
    ask: "Explain why no worker takes them and recommend the setup change.",
  },
  agent_invalid: {
    subject: (item) =>
      `agent \`${item.agent}\` in binding \`${firstBindingOf(item)}\` of project \`${item.project.id}\``,
    ask: "Explain the invalid configuration and recommend the fix.",
  },
  credential_refused: {
    subject: (item) => `credential \`${item.credential}\``,
    ask: "Explain why the provider refuses it and recommend the fix.",
  },
  request_rejected: {
    subject: (item) => `agent \`${item.agent}\``,
    ask: "Explain why the provider rejects its requests and recommend the fix.",
  },
};

export function nodeCaseRequestOf(item: NodeCaseItem): string {
  return `${CASE_REQUEST_PREFIX}node \`${item.node.id}\` (${item.node.state}). ${CASE_ASKS[item.kind]}`;
}

export function fixCaseRequestOf(item: FixAttentionItem): string {
  const entry = FIX_ASKS[item.kind] as FixAsk<FixKind>;
  return `${CASE_REQUEST_PREFIX}fix ${item.kind} ${entry.subject(item)}. ${entry.ask}`;
}

export function caseRequestOf(item: AttentionItem): string | null {
  if (item.kind === "tool_approval" || item.kind === "inbox_item") return null;
  if (item.group === "fixes") return fixCaseRequestOf(item);
  return nodeCaseRequestOf(item);
}

export function isCaseConversation(item: WorkbenchSessionListItem): boolean {
  return item.first_message.startsWith(CASE_REQUEST_PREFIX);
}
