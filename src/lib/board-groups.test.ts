import { describe, expect, it } from "vitest";

import type { InboxItem, Project } from "@/api/types";

import { cardGroupsOf } from "./board-groups";
import { boardTabNamed } from "./board-tabs";
import { inboxItemsOf } from "./inbox-attention";

const PROJECT: Project = {
  id: "prj-1",
  name: "atlas",
  binding_set_version: 1,
  created_at: 1,
  paused_at: null,
  workspace_directory: "/state/prj-1",
};

function inboxItem(id: string, reason: InboxItem["reason"]): InboxItem {
  return {
    link_update_id: id,
    project_id: "prj-1",
    external_link: { kind: "jira_issue", resource_identity: "conversation:jira:x", key: "KD-1" },
    reason,
    state: "open",
    occurred_at: 1,
    done_at: null,
    snoozed_until: null,
    inbound_event_id: "event_1",
    actor_id: "actor_1",
    trusted: true,
    linked_node_ids: [],
    content: null,
  };
}

describe("cardGroupsOf", () => {
  it("groups the inbox cards by reason in rank order with a counted header", () => {
    const cards = inboxItemsOf(
      [
        inboxItem("a", "participating"),
        inboxItem("b", "linked"),
        inboxItem("c", "participating"),
        inboxItem("d", "review_requested"),
      ],
      [PROJECT],
    );

    const groups = cardGroupsOf(boardTabNamed("inbox"), cards);

    expect(groups.map((group) => [group.header, group.cards.map((card) => card.id)])).toEqual([
      ["Linked to your nodes · 1", ["b"]],
      ["Review requested · 1", ["d"]],
      ["Replies in your threads · 2", ["a", "c"]],
    ]);
  });

  it("names every reason label", () => {
    const reasons = [
      "linked",
      "review_requested",
      "assigned",
      "direct",
      "mentioned",
      "participating",
    ] as const;
    const cards = inboxItemsOf(
      reasons.map((reason) => inboxItem(reason, reason)),
      [PROJECT],
    );

    expect(cardGroupsOf(boardTabNamed("inbox"), cards).map((group) => group.header)).toEqual([
      "Linked to your nodes · 1",
      "Review requested · 1",
      "Assigned to you · 1",
      "Direct messages · 1",
      "Mentions you · 1",
      "Replies in your threads · 1",
    ]);
  });

  it("holds one group with no header for another tab", () => {
    const cards = inboxItemsOf([inboxItem("a", "linked")], [PROJECT]);

    expect(cardGroupsOf(boardTabNamed("blocked"), cards)).toEqual([
      { key: "blocked", header: null, cards },
    ]);
  });
});
