import { describe, expect, it } from "vitest";

import type { InboxItem, MissionNodeRecord, NodeState, Project } from "@/api/types";

import type { ProjectSnapshot } from "./attention";
import {
  inboxHrefOf,
  inboxImpactTextOf,
  inboxItemsOf,
  inboxLineOf,
  inboxNodesOf,
  inboxSubjectOf,
  mergedInboxItemsOf,
} from "./inbox-attention";

const PROJECT: Project = {
  id: "prj-1",
  name: "atlas",
  binding_set_version: 1,
  created_at: 1,
  paused_at: null,
  workspace_directory: "/state/prj-1",
};

function inboxItem(overrides: Partial<InboxItem> = {}): InboxItem {
  return {
    link_update_id: "link_update_1",
    project_id: "prj-1",
    external_link: {
      kind: "github_issue",
      resource_identity: "conversation:github:acme/shop",
      number: 42,
    },
    reason: "linked",
    state: "open",
    occurred_at: 1_000,
    done_at: null,
    snoozed_until: null,
    inbound_event_id: "event_1",
    actor_id: "actor_1",
    trusted: true,
    linked_node_ids: [],
    content: {
      author: "ulrich",
      body: "Please look.",
      url: "https://github.com/x",
      occurred_at: 1,
    },
    ...overrides,
  };
}

describe("inboxSubjectOf", () => {
  it("names a GitHub issue by repository and number", () => {
    expect(inboxSubjectOf(inboxItem().external_link)).toBe("acme/shop#42");
  });

  it("names a Jira issue by its key", () => {
    expect(
      inboxSubjectOf({ kind: "jira_issue", resource_identity: "conversation:jira:x", key: "KD-7" }),
    ).toBe("KD-7");
  });

  it("names a Slack thread by its channel", () => {
    expect(
      inboxSubjectOf({
        kind: "slack_thread",
        resource_identity: "conversation:slack:x",
        channel: "dev",
        thread_ts: "1.2",
      }),
    ).toBe("#dev");
  });
});

describe("inboxItemsOf", () => {
  it("sets id, subject, project and at from the thread", () => {
    const [item] = inboxItemsOf([inboxItem()], [PROJECT]);

    expect(item).toMatchObject({
      id: "link_update_1",
      kind: "inbox_item",
      group: "inbox",
      subject: "acme/shop#42",
      project: PROJECT,
      at: 1_000,
    });
  });

  it("drops a thread of an unknown project", () => {
    expect(inboxItemsOf([inboxItem({ project_id: "prj-9" })], [PROJECT])).toEqual([]);
  });
});

describe("inboxLineOf", () => {
  const line = (overrides: Partial<InboxItem>) => {
    const [item] = inboxItemsOf([inboxItem(overrides)], [PROJECT]);
    if (item === undefined) throw new Error("No item.");
    return inboxLineOf(item);
  };

  it("holds the author and the first line of the body", () => {
    expect(
      line({ content: { author: "ulrich", body: "First\nSecond", url: "", occurred_at: 1 } }),
    ).toBe("ulrich: First");
  });

  it("truncates a long line", () => {
    const text = line({
      content: { author: "ulrich", body: "x".repeat(300), url: "", occurred_at: 1 },
    });

    expect(text.length).toBe(120);
    expect(text.endsWith("…")).toBe(true);
  });

  it("states that the text is gone when the content is null", () => {
    expect(line({ content: null })).toBe("The text is no longer stored.");
  });
});

describe("mergedInboxItemsOf", () => {
  it("keeps each thread once, the later list first in precedence", () => {
    const merged = mergedInboxItemsOf([
      [inboxItem(), inboxItem({ link_update_id: "link_update_2" })],
      [inboxItem({ trusted: false })],
    ]);

    expect(merged.map((item) => [item.link_update_id, item.trusted])).toEqual([
      ["link_update_1", false],
      ["link_update_2", true],
    ]);
  });
});

describe("inboxHrefOf", () => {
  it("answers an http or https address", () => {
    expect(inboxHrefOf("https://github.com/acme/shop/issues/42")).toBe(
      "https://github.com/acme/shop/issues/42",
    );
  });

  it("answers null for another scheme or for text", () => {
    expect(inboxHrefOf("javascript:alert(1)")).toBeNull();
    expect(inboxHrefOf("not an address")).toBeNull();
  });
});

describe("inboxNodesOf", () => {
  function node(id: string, state: NodeState, retiredAt: number | null = null) {
    return {
      id,
      state,
      retired_at: retiredAt,
      content: { name: `Node ${id}` },
    } as MissionNodeRecord;
  }
  const snapshot = {
    project: PROJECT,
    missionVersion: 1,
    nodes: [
      node("run", "Executing"),
      node("paused", "Paused"),
      node("done", "Completed"),
      node("done-plain", "Completed"),
      node("gone", "Executing", 5),
    ],
    followups: [
      {
        id: "f1",
        node_id: "done",
        approved_at: null,
        rejected_at: null,
      },
    ],
  } as unknown as ProjectSnapshot;
  const [item] = inboxItemsOf(
    [inboxItem({ linked_node_ids: ["run", "paused", "done", "done-plain", "gone", "unknown"] })],
    [PROJECT],
  );
  if (item === undefined) throw new Error("No item.");

  it("lists each linked node that a snapshot holds", () => {
    expect(inboxNodesOf(item, [snapshot]).linked.map((entry) => entry.node.id)).toEqual([
      "run",
      "paused",
      "done",
      "done-plain",
      "gone",
    ]);
  });

  it("offers Pause for a node that is not terminal and not Paused", () => {
    expect(inboxNodesOf(item, [snapshot]).pausable.map((entry) => entry.id)).toEqual(["run"]);
  });

  it("offers Check now for each linked node that is not retired", () => {
    expect(inboxNodesOf(item, [snapshot]).checkable.map((entry) => entry.id)).toEqual([
      "run",
      "paused",
      "done",
      "done-plain",
    ]);
  });

  it("offers Decide follow-up for a terminal node with an open proposal", () => {
    expect(inboxNodesOf(item, [snapshot]).followups.map((entry) => entry.id)).toEqual(["done"]);
  });
});

describe("inboxImpactTextOf", () => {
  it("counts the linked nodes", () => {
    expect(inboxImpactTextOf(0)).toBe("No node links to this thread.");
    expect(inboxImpactTextOf(1)).toBe("1 node links to this thread.");
    expect(inboxImpactTextOf(3)).toBe("3 nodes link to this thread.");
  });
});
