import type { ExternalLink, InboxItem, MissionNodeRecord, Project } from "@/api/types";

import { type ItemBase, openFollowupsOf, type ProjectSnapshot } from "./attention";
import { type HeldNode, heldNodesOf } from "./board-detail-joins";
import { isTerminal } from "./node-state";

const GITHUB_REPOSITORY = /^conversation:github:([^/\s]+\/[^/\s]+)$/;
const LINE_LIMIT = 120;
export const NO_TEXT = "The text is no longer stored.";

export interface InboxAttentionItem extends ItemBase {
  readonly group: "inbox";
  readonly kind: "inbox_item";
  readonly at: number;
  readonly inbox: InboxItem;
}

export function inboxSubjectOf(link: ExternalLink): string {
  if (link.kind === "jira_issue") return link.key;
  if (link.kind === "slack_thread") return `#${link.channel}`;
  const repository = GITHUB_REPOSITORY.exec(link.resource_identity)?.[1];
  return `${repository ?? link.resource_identity}#${link.number}`;
}

export function inboxItemsOf(
  items: readonly InboxItem[],
  projects: readonly Project[],
): readonly InboxAttentionItem[] {
  return items.flatMap((item): readonly InboxAttentionItem[] => {
    const project = projects.find((candidate) => candidate.id === item.project_id);
    if (project === undefined) return [];
    return [
      {
        id: item.link_update_id,
        group: "inbox",
        kind: "inbox_item",
        project,
        subject: inboxSubjectOf(item.external_link),
        at: item.occurred_at,
        inbox: item,
      },
    ];
  });
}

export function inboxLineOf(item: InboxAttentionItem): string {
  const { content } = item.inbox;
  if (content === null) return NO_TEXT;
  const first = content.body.split(/\r?\n/, 1)[0]?.trim() ?? "";
  const line = `${content.author}: ${first}`;
  return line.length > LINE_LIMIT ? `${line.slice(0, LINE_LIMIT - 1)}…` : line;
}

export function inboxHrefOf(url: string): string | null {
  const parsed = URL.parse(url);
  return parsed?.protocol === "https:" || parsed?.protocol === "http:" ? parsed.href : null;
}

export interface InboxNodes {
  readonly linked: readonly HeldNode[];
  readonly pausable: readonly MissionNodeRecord[];
  readonly checkable: readonly MissionNodeRecord[];
  readonly followups: readonly MissionNodeRecord[];
}

export function inboxNodesOf(
  item: InboxAttentionItem,
  snapshots: readonly ProjectSnapshot[],
): InboxNodes {
  const linked = heldNodesOf(item.inbox.linked_node_ids, snapshots);
  const live = linked.filter(({ node }) => node.retired_at === null);
  const hasFollowup = ({ node, project }: HeldNode) =>
    openFollowupsOf(
      snapshots.find((snapshot) => snapshot.project.id === project.id)?.followups,
      node.id,
    ).length > 0;
  return {
    linked,
    pausable: live
      .filter(({ node }) => !isTerminal(node.state) && node.state !== "Paused")
      .map(({ node }) => node),
    checkable: live.map(({ node }) => node),
    followups: live
      .filter((entry) => isTerminal(entry.node.state) && hasFollowup(entry))
      .map(({ node }) => node),
  };
}
