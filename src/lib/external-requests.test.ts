import { describe, expect, it } from "vitest";

import type {
  MissionExternalAction,
  MissionRunnableNode,
  NodeState,
  RepositoryActionName,
} from "@/api/types";

import {
  hasOpenAttempt,
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
      configuration: { base_branch: "main" },
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
