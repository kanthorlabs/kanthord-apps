import type { MissionProposal } from "@/api/types";

import {
  type AttentionDetails,
  type AttentionItem,
  type BlockedItem,
  detailOf,
  openProposalsOf,
} from "./attention";

export const BOARD_TAB = {
  Tool: "tool",
  Setup: "setup",
  Resume: "paused",
  Proposal: "proposal",
  Rule: "blocked",
  Outside: "outside",
} as const;

export type BoardTabId = (typeof BOARD_TAB)[keyof typeof BOARD_TAB];

export interface BoardTab {
  readonly id: BoardTabId;
  readonly name: string;
  readonly short: string;
  readonly verb: string;
  readonly what: string;
  readonly key: string;
}

export const BOARD_TABS: readonly BoardTab[] = [
  {
    id: BOARD_TAB.Tool,
    name: "Approve tool",
    short: "Tool",
    verb: "Approve or reject.",
    what: "A live agent run waits for the answer.",
    key: "1",
  },
  {
    id: BOARD_TAB.Setup,
    name: "Fix setup",
    short: "Setup",
    verb: "Change the setup.",
    what: "Workers cannot progress until you change a credential, an environment, a binding, an agent or a paused project.",
    key: "2",
  },
  {
    id: BOARD_TAB.Resume,
    name: "Resume",
    short: "Resume",
    verb: "Resume or discard.",
    what: "A node is Paused at a limit or by a human. A resume lets the node run again.",
    key: "3",
  },
  {
    id: BOARD_TAB.Proposal,
    name: "Decide proposal",
    short: "Decide",
    verb: "Decide the proposals.",
    what: "A reviewer proposes a new node. You decide.",
    key: "4",
  },
  {
    id: BOARD_TAB.Rule,
    name: "Rule",
    short: "Rule",
    verb: "Act on the stopped node.",
    what: "A node stops until you act: a closed attempt or a discarded dependency.",
    key: "5",
  },
  {
    id: BOARD_TAB.Outside,
    name: "Act outside",
    short: "Outside",
    verb: "Act on the platform.",
    what: "KanthorD waits for an act outside, for example a merge.",
    key: "6",
  },
];

export function openProposalsReadOf(
  item: BlockedItem,
  details: AttentionDetails,
): readonly MissionProposal[] | null {
  const detail = detailOf(details, item.node);
  if (detail?.kind !== "blocked" || detail.proposals.status !== "ready") return null;
  return openProposalsOf(item.node, detail.proposals.data);
}

function isProposalItem(item: BlockedItem, details: AttentionDetails): boolean {
  if (item.node.intent !== "examine") return false;
  const open = openProposalsReadOf(item, details);
  return open === null || open.length > 0;
}

export function boardTabOf(item: AttentionItem, details: AttentionDetails): BoardTabId {
  switch (item.kind) {
    case "tool_approval":
      return BOARD_TAB.Tool;
    case "project_paused":
    case "environment_failed":
    case "environment_pending":
    case "no_taker":
    case "agent_invalid":
    case "credential_refused":
    case "request_rejected":
      return BOARD_TAB.Setup;
    case "paused":
      return BOARD_TAB.Resume;
    case "blocked":
      return isProposalItem(item, details) ? BOARD_TAB.Proposal : BOARD_TAB.Rule;
    case "dependency_discarded":
      return BOARD_TAB.Rule;
    case "merge_wait":
    case "delivery_unconfirmed":
      return BOARD_TAB.Outside;
  }
}

export function boardTabById(id: string): BoardTab | undefined {
  return BOARD_TABS.find((entry) => entry.id === id);
}

export function boardTabNamed(id: BoardTabId): BoardTab {
  const tab = boardTabById(id);
  if (tab === undefined) throw new Error(`No board tab ${id}.`);
  return tab;
}
