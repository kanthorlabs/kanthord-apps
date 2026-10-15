import { describe, expect, it } from "vitest";

import type {
  ActionLanding,
  MissionEvidence,
  MissionExternalAction,
  MissionRunnableNode,
  NodeState,
  RepositoryActionName,
} from "@/api/types";

import type { OutsideAttentionItem } from "./attention";
import {
  causeSentenceOf,
  deliveryRequestsOf,
  deliveryText,
  hasOpenAttempt,
  humanMergeRequestOf,
  mergeWaitText,
  readFailureText,
  requestsClearOf,
  unresolvedRequestsOf,
  unresolvedRequestsText,
} from "./external-requests";

function node(state: NodeState, attempt: number): MissionRunnableNode {
  return {
    id: "node_1",
    filename: "node_1.md",
    mission_id: "mission_1",
    parent_id: null,
    visible_revision: 1,
    content: { name: "Audit log", requirement: "", criterion: "", verifications: [], bindings: [] },
    retired_at: null,
    pinned_by_attempts: [],
    kind: "objective",
    state,
    attempt,
    priority: 0,
    depends_on: [],
  };
}

function action(
  kind: RepositoryActionName,
  resolution: MissionExternalAction["resolution"],
  requested = true,
  landing: ActionLanding = "human",
): MissionExternalAction {
  return {
    node_id: "node_1",
    attempt: 2,
    action: {
      key: `repo.${kind}`,
      binding_id: "binding_1",
      action: kind,
      expected_end_state: kind === "pull_request" ? "pull_request_merged" : "base_branch_pushed",
      follows: null,
      configuration: { base_branch: "main", landing },
    },
    requested,
    request_evidence_id: requested ? "evidence_1" : null,
    resolution,
  };
}

describe("unresolvedRequestsOf", () => {
  it("keeps the requested actions that are unresolved", () => {
    const unresolved = action("pull_request", "unresolved");

    expect(
      unresolvedRequestsOf([
        unresolved,
        action("merge_push", "expected-end"),
        action("merge_push", "other-end"),
        action("pull_request", "unrequested", false),
      ]),
    ).toEqual([unresolved]);
  });
});

describe("unresolvedRequestsText", () => {
  it("names one pull request", () => {
    expect(unresolvedRequestsText(2, [action("pull_request", "unresolved")], true)).toBe(
      "Attempt 2 has an unresolved pull request. Override and discard wait for its end state. Resume the node.",
    );
  });

  it("names one push", () => {
    expect(unresolvedRequestsText(3, [action("merge_push", "unresolved")], true)).toBe(
      "Attempt 3 has an unresolved push to the base branch. Override and discard wait for its end state. Resume the node.",
    );
  });

  it("counts several requests", () => {
    expect(
      unresolvedRequestsText(
        1,
        [action("pull_request", "unresolved"), action("merge_push", "unresolved")],
        true,
      ),
    ).toBe(
      "Attempt 1 has 2 unresolved requests. Override and discard wait for their end states. Resume the node.",
    );
  });

  it("leaves out the Resume sentence for a node that is not Paused", () => {
    expect(unresolvedRequestsText(2, [action("pull_request", "unresolved")], false)).toBe(
      "Attempt 2 has an unresolved pull request. Override and discard wait for its end state.",
    );
  });
});

describe("hasOpenAttempt", () => {
  it("holds for a started node that is not Blocked", () => {
    expect(hasOpenAttempt(node("Executing", 1))).toBe(true);
    expect(hasOpenAttempt(node("Paused", 2))).toBe(true);
    expect(hasOpenAttempt(node("Pending", 2))).toBe(true);
  });

  it("fails for attempt 0 and for a Blocked node", () => {
    expect(hasOpenAttempt(node("Pending", 0))).toBe(false);
    expect(hasOpenAttempt(node("Blocked", 3))).toBe(false);
    expect(hasOpenAttempt(node("Completed", 3))).toBe(false);
    expect(hasOpenAttempt(node("Discarded", 3))).toBe(false);
  });
});

describe("requestsClearOf", () => {
  it("needs no read for a node without an open attempt", () => {
    expect(requestsClearOf(node("Blocked", 2), null)).toBe(true);
    expect(requestsClearOf(node("Pending", 0), null)).toBe(true);
  });

  it("waits for the read of a node with an open attempt", () => {
    expect(requestsClearOf(node("Executing", 2), null)).toBe(false);
  });

  it("holds while no request is unresolved, for every state with an open attempt", () => {
    const done = [action("pull_request", "expected-end")];
    const open = [action("pull_request", "unresolved")];

    expect(requestsClearOf(node("Executing", 2), done)).toBe(true);
    expect(requestsClearOf(node("Executing", 2), open)).toBe(false);
    expect(requestsClearOf(node("External.Success", 2), open)).toBe(false);
    expect(requestsClearOf(node("Paused", 2), open)).toBe(false);
  });
});

describe("readFailureText", () => {
  it("names the failed read and the consequence", () => {
    expect(readFailureText(2, "The daemon did not answer.", true)).toBe(
      "The executions or the external actions of attempt 2 could not be read: The daemon did not answer. The controls wait for them.",
    );
    expect(readFailureText(3, "Unreachable", false)).toBe(
      "The external actions of attempt 3 could not be read: Unreachable. The controls wait for them.",
    );
  });
});

function evidenceOf(createdAt: number, number: number | null): MissionEvidence {
  return {
    id: "evidence_1",
    node_id: "node_1",
    attempt: 2,
    subject: "Pull request",
    assets:
      number === null
        ? []
        : [
            {
              id: "asset_1",
              kind: "platform",
              address: {
                kind: "pull_request",
                resource_identity: "repository:github:kanthorlabs/atlas",
                number,
              },
              published_at: createdAt,
              expired_at: null,
            },
          ],
    provenance: { kind: "human", account: "a", name: "A" },
    created_at: createdAt,
  };
}

describe("humanMergeRequestOf and deliveryRequestsOf", () => {
  it("treats a pull request that a human lands as a human merge", () => {
    const merge = action("pull_request", "unresolved");

    expect(humanMergeRequestOf([action("merge_push", "unresolved"), merge])).toBe(merge);
    expect(deliveryRequestsOf([merge])).toEqual([]);
  });

  it("treats a pull request that kanthord lands and a push as deliveries", () => {
    const landed = action("pull_request", "unresolved", true, "kanthord");
    const push = action("merge_push", "unresolved");

    expect(humanMergeRequestOf([landed, push])).toBeNull();
    expect(deliveryRequestsOf([landed, push])).toEqual([landed, push]);
  });

  it("ignores a request that has its end state", () => {
    expect(humanMergeRequestOf([action("pull_request", "expected-end")])).toBeNull();
  });
});

describe("mergeWaitText", () => {
  it("names the pull request and its repository", () => {
    expect(mergeWaitText(evidenceOf(1, 12))).toBe(
      "Pull request #12 on github.com/kanthorlabs/atlas waits for a merge. Merge it, then check.",
    );
  });

  it("names no number when the evidence carries no pull request", () => {
    expect(mergeWaitText(null)).toBe("A pull request waits for a merge. Merge it, then check.");
  });
});

describe("deliveryText", () => {
  const NOW = 100 * 60_000;

  it("names a push with its branch and age", () => {
    expect(
      deliveryText(action("merge_push", "unresolved"), evidenceOf(NOW - 25 * 60_000, null), NOW),
    ).toBe("kanthord pushed to main 25 minutes ago, and no end state arrived. Check the delivery.");
  });

  it("names the merge that kanthord requests", () => {
    expect(
      deliveryText(
        action("pull_request", "unresolved", true, "kanthord"),
        evidenceOf(NOW - 12 * 60_000, 7),
        NOW,
      ),
    ).toBe(
      "kanthord requested the merge of pull request #7 12 minutes ago, and no end state arrived. Check the delivery.",
    );
  });
});

describe("causeSentenceOf", () => {
  const NOW = 100 * 60_000;
  const waiting = node("External.Requested", 2);

  function itemOf(
    kind: OutsideAttentionItem["kind"],
    request: OutsideAttentionItem["request"],
  ): OutsideAttentionItem {
    return {
      id: `${kind}:node_1`,
      group: "outside",
      kind,
      project: {
        id: "prj-1",
        name: "atlas",
        binding_set_version: 1,
        created_at: 1,
        paused_at: null,
        workspace_directory: "/state/prj-1",
      },
      subject: "Audit log",
      at: null,
      missionVersion: 7,
      node: waiting,
      nodes: [waiting],
      cause: "Waits",
      request,
    };
  }

  it("names the pull request that waits for a merge", () => {
    const request = { action: action("pull_request", "unresolved"), evidence: evidenceOf(1, 12) };

    expect(causeSentenceOf(itemOf("merge_wait", request), NOW)).toBe(
      "Pull request #12 on github.com/kanthorlabs/atlas waits for a merge. Merge it, then check.",
    );
  });

  it("names the delivery that has its evidence", () => {
    const request = {
      action: action("merge_push", "unresolved"),
      evidence: evidenceOf(NOW - 25 * 60_000, null),
    };

    expect(causeSentenceOf(itemOf("delivery_unconfirmed", request), NOW)).toBe(
      "kanthord pushed to main 25 minutes ago, and no end state arrived. Check the delivery.",
    );
  });

  it("names a delivery without evidence", () => {
    const request = { action: action("merge_push", "unresolved"), evidence: null };

    expect(causeSentenceOf(itemOf("delivery_unconfirmed", request), NOW)).toBe(
      "No end state arrived. Check the delivery.",
    );
  });
});
