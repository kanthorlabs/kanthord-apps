import { describe, expect, it } from "vitest";

import type { ExternalLink, MissionNodeRecord, MissionRevision, NodeState } from "@/api/types";

import { linkableNodesOf, nodeLinkUpdateOf } from "./node-link-update";

const LINK: ExternalLink = {
  kind: "github_issue",
  resource_identity: "conversation:github:acme/shop",
  number: 42,
};

function node(id: string, state: NodeState, retiredAt: number | null = null): MissionNodeRecord {
  return { id, state, retired_at: retiredAt } as MissionNodeRecord;
}

const REVISION = {
  node_id: "n1",
  revision: 3,
  content: {
    name: "Fix login",
    requirement: "Fix it.",
    criterion: "It works.",
    verifications: ["pnpm test"],
    bindings: ["repo"],
    intent: "implement",
    tags: [],
    external_links: [{ kind: "jira_issue", resource_identity: "conversation:jira:x", key: "KD-1" }],
  },
  tasks: [{ id: "task_1", filename: "a.md", content: { name: "T" } }],
} as unknown as MissionRevision;

describe("linkableNodesOf", () => {
  it("keeps the nodes that are not terminal and not retired", () => {
    const nodes = [
      node("a", "Executing"),
      node("b", "Completed"),
      node("c", "Discarded"),
      node("d", "Pending", 9),
      node("e", "Paused"),
    ];

    expect(linkableNodesOf(nodes).map((entry) => entry.id)).toEqual(["a", "e"]);
  });
});

describe("nodeLinkUpdateOf", () => {
  it("keeps the content and the tasks of the revision and adds the link and the binding", () => {
    const update = nodeLinkUpdateOf(REVISION, LINK, "chat", 7, "Link it.");

    expect(update.expected_mission_version).toBe(7);
    expect(update.reason).toBe("Link it.");
    expect(update.tasks).toBe(REVISION.tasks);
    expect(update.content).toMatchObject({
      name: "Fix login",
      bindings: ["repo", "chat"],
      external_links: [
        { kind: "jira_issue", resource_identity: "conversation:jira:x", key: "KD-1" },
        LINK,
      ],
    });
  });

  it("adds neither a link nor a binding twice", () => {
    const once = nodeLinkUpdateOf(REVISION, LINK, "chat", 7, "x");
    const again = nodeLinkUpdateOf({ ...REVISION, content: once.content }, LINK, "chat", 7, "x");

    expect(again.content.bindings).toEqual(["repo", "chat"]);
    expect(again.content.external_links).toHaveLength(2);
  });
});
