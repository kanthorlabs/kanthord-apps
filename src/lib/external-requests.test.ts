import { describe, expect, it } from "vitest";

import type {
  ActionLanding,
  MissionExternalAction,
  MissionNodeRecord,
  NodeState,
  RepositoryActionName,
} from "@/api/types";

import {
  deliveryRequestsOf,
  hasOpenAttempt,
  humanMergeRequestOf,
  readFailureText,
  requestsClearOf,
  unresolvedRequestsOf,
  unresolvedRequestsText,
} from "./external-requests";

function node(state: NodeState, attempt: number): MissionNodeRecord {
  return {
    id: "node_1",
    filename: "node_1.md",
    mission_id: "mission_1",
    visible_revision: 1,
    content: {
      name: "Audit log",
      requirement: "",
      criterion: "",
      verifications: [],
      bindings: [],
      intent: "implement",
      tags: [],
    },
    retired_at: null,
    pinned_by_attempts: [],
    pinned_revision: null,
    intent: "implement",
    tags: [],
    tasks: [],
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
        action("push", "expected-end"),
        action("push", "other-end"),
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
    expect(unresolvedRequestsText(3, [action("push", "unresolved")], true)).toBe(
      "Attempt 3 has an unresolved push to the base branch. Override and discard wait for its end state. Resume the node.",
    );
  });

  it("counts several requests", () => {
    expect(
      unresolvedRequestsText(
        1,
        [action("pull_request", "unresolved"), action("push", "unresolved")],
        true,
      ),
    ).toBe(
      "Attempt 1 has 2 unresolved requests. Override and discard wait for their end states. Resume the node.",
    );
  });

  it("names the acts that the caller passes", () => {
    expect(
      unresolvedRequestsText(2, [action("pull_request", "unresolved")], false, "Discard waits"),
    ).toBe("Attempt 2 has an unresolved pull request. Discard waits for its end state.");
    expect(
      unresolvedRequestsText(
        1,
        [action("pull_request", "unresolved"), action("push", "unresolved")],
        false,
        "Discard waits",
      ),
    ).toBe("Attempt 1 has 2 unresolved requests. Discard waits for their end states.");
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
    expect(readFailureText(3, "Unreachable", false, "Discard waits for it.")).toBe(
      "The external actions of attempt 3 could not be read: Unreachable. Discard waits for it.",
    );
  });
});

describe("humanMergeRequestOf and deliveryRequestsOf", () => {
  it("treats a pull request that a human lands as a human merge", () => {
    const merge = action("pull_request", "unresolved");

    expect(humanMergeRequestOf([action("push", "unresolved"), merge])).toBe(merge);
    expect(deliveryRequestsOf([merge])).toEqual([]);
  });

  it("treats a pull request that kanthord lands and a push as deliveries", () => {
    const landed = action("pull_request", "unresolved", true, "kanthord");
    const push = action("push", "unresolved");

    expect(humanMergeRequestOf([landed, push])).toBeNull();
    expect(deliveryRequestsOf([landed, push])).toEqual([landed, push]);
  });

  it("ignores a request that has its end state", () => {
    expect(humanMergeRequestOf([action("pull_request", "expected-end")])).toBeNull();
  });
});
