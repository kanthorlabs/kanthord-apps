import { describe, expect, it } from "vitest";

import type {
  MissionExternalAction,
  MissionNodeRecord,
  MissionRunnableNode,
  NodeState,
} from "@/api/types";

import {
  choosesTarget,
  defaultTargetOf,
  resumeEndOf,
  resumeNotesOf,
  waitingNeedsOf,
  type ResumeContext,
} from "./resume-target";

function node(
  id: string,
  name: string,
  state: NodeState,
  overrides: Partial<MissionRunnableNode> = {},
): MissionRunnableNode {
  return {
    id,
    filename: `${id}.md`,
    mission_id: "mission_1",
    parent_id: null,
    visible_revision: 1,
    content: { name, requirement: "", criterion: "", verifications: [], bindings: [] },
    retired_at: null,
    pinned_by_attempts: [],
    kind: "objective",
    state,
    attempt: 2,
    priority: 0,
    depends_on: [],
    ...overrides,
  };
}

function action(
  resolution: MissionExternalAction["resolution"],
  requested = resolution !== "unrequested",
): MissionExternalAction {
  return {
    node_id: "n1",
    attempt: 2,
    action: {
      key: "repo.pull_request",
      binding_id: "binding_1",
      action: "pull_request",
      expected_end_state: "pull_request_merged",
      follows: null,
      configuration: { base_branch: "main" },
    },
    requested,
    request_evidence_id: requested ? "evidence_1" : null,
    resolution,
  };
}

const PAUSED = node("n1", "Compute the rates", "Paused");

function context(overrides: Partial<ResumeContext> = {}): ResumeContext {
  return { node: PAUSED, nodes: [PAUSED], actions: [], cause: null, ...overrides };
}

describe("resumeEndOf", () => {
  it("moves to External.Failed when an action ended in another state", () => {
    expect(
      resumeEndOf(context({ actions: [action("other-end"), action("unresolved")] }), "Available"),
    ).toEqual({ kind: "external-failed" });
  });

  it("moves to External.Success when every action reached its expected end", () => {
    expect(
      resumeEndOf(
        context({ actions: [action("expected-end"), action("expected-end")] }),
        "Waiting",
      ),
    ).toEqual({ kind: "external-success" });
  });

  it("returns to External.Requested while a request is open", () => {
    expect(resumeEndOf(context({ actions: [action("unresolved")] }), "Available")).toEqual({
      kind: "external-requested",
      open: true,
    });
  });

  it("returns to External.Requested when a required action holds no request", () => {
    expect(
      resumeEndOf(
        context({ actions: [action("expected-end"), action("unrequested")] }),
        "Available",
      ),
    ).toEqual({ kind: "external-requested", open: false });
  });

  it("follows the target when no action holds a request", () => {
    expect(resumeEndOf(context({ actions: [action("unrequested")] }), "Waiting")).toEqual({
      kind: "waiting",
    });
    expect(resumeEndOf(context(), "Available")).toEqual({ kind: "available" });
  });

  it("returns to Pending and names the dependency that is not Completed", () => {
    const dependent = node("n1", "Compute the rates", "Paused", { depends_on: ["n2"] });
    const nodes: readonly MissionNodeRecord[] = [
      dependent,
      node("n2", "Sign-up form", "Executing"),
    ];

    expect(resumeEndOf(context({ node: dependent, nodes }), "Available")).toEqual({
      kind: "pending",
      dependency: { name: "Sign-up form" },
    });
  });

  it("reads the dependencies of an ancestor too", () => {
    const parent = node("n0", "Checkout", "Pending", { depends_on: ["n2"] });
    const child = node("n1", "Compute the rates", "Paused", { parent_id: "n0" });
    const nodes = [parent, child, node("n2", "Sign-up form", "Available")];

    expect(resumeEndOf(context({ node: child, nodes }), "Available").kind).toBe("pending");
  });

  it("returns to Available when every dependency is Completed", () => {
    const dependent = node("n1", "Compute the rates", "Paused", { depends_on: ["n2"] });
    const nodes = [dependent, node("n2", "Sign-up form", "Completed")];

    expect(resumeEndOf(context({ node: dependent, nodes }), "Available")).toEqual({
      kind: "available",
    });
  });

  it("treats a dependency that the read data lacks as not Completed", () => {
    const dependent = node("n1", "Compute the rates", "Paused", { depends_on: ["n_missing"] });

    expect(resumeEndOf(context({ node: dependent, nodes: [dependent] }), "Available")).toEqual({
      kind: "pending",
      dependency: { id: "n_missing" },
    });
  });
});

describe("waitingNeedsOf", () => {
  it("holds no need for an objective with no request and no open dependency", () => {
    expect(waitingNeedsOf(context())).toEqual([]);
  });

  it("needs every objective of an initiative to be terminal", () => {
    const initiative = node("n1", "Checkout", "Paused", { kind: "initiative" });
    const nodes = [
      initiative,
      node("n2", "Done", "Completed", { parent_id: "n1" }),
      node("n3", "Open", "Available", { parent_id: "n1" }),
    ];

    expect(waitingNeedsOf(context({ node: initiative, nodes }))).toEqual([{ kind: "objectives" }]);
  });

  it("skips a retired objective of an initiative", () => {
    const initiative = node("n1", "Checkout", "Paused", { kind: "initiative" });
    const nodes = [initiative, node("n3", "Old", "Available", { parent_id: "n1", retired_at: 5 })];

    expect(waitingNeedsOf(context({ node: initiative, nodes }))).toEqual([]);
  });

  it("needs an unresolved request to end", () => {
    expect(waitingNeedsOf(context({ actions: [action("unresolved")] }))).toEqual([
      { kind: "requests" },
    ]);
  });

  it("names the dependency that is not Completed", () => {
    const dependent = node("n1", "Compute the rates", "Paused", { depends_on: ["n2"] });
    const nodes = [dependent, node("n2", "Sign-up form", "Blocked")];

    expect(waitingNeedsOf(context({ node: dependent, nodes }))).toEqual([
      { kind: "dependency", dependency: { name: "Sign-up form" } },
    ]);
  });
});

describe("defaultTargetOf", () => {
  it("picks Waiting at the Further-work limit when Waiting is offered", () => {
    expect(defaultTargetOf(context({ cause: "further-work-limit" }))).toBe("Waiting");
  });

  it("picks Available at the Further-work limit when Waiting needs something", () => {
    expect(
      defaultTargetOf(context({ cause: "further-work-limit", actions: [action("unresolved")] })),
    ).toBe("Available");
  });

  it.each([["failure-limit" as const], ["human" as const], [null]])(
    "picks Available for the cause %s",
    (cause) => {
      expect(defaultTargetOf(context({ cause }))).toBe("Available");
    },
  );
});

describe("resumeNotesOf", () => {
  it("adds the failure count note at the Failure limit", () => {
    expect(resumeNotesOf(context({ cause: "failure-limit" }), "Available")).toEqual([
      "failure-count",
    ]);
  });

  it("adds the stall count note at the Further-work limit for the target Available only", () => {
    const further = context({ cause: "further-work-limit" });

    expect(resumeNotesOf(further, "Available")).toEqual(["stall-count-waiting-offered"]);
    expect(resumeNotesOf(further, "Waiting")).toEqual([]);
  });

  it("leaves out the Waiting sentence when a Waiting need is unmet", () => {
    const dependent = node("n1", "Compute the rates", "Paused", { depends_on: ["n2"] });
    const blocker = node("n2", "Export the orders", "Executing");
    const further = context({
      node: dependent,
      nodes: [dependent, blocker],
      cause: "further-work-limit",
    });

    expect(resumeNotesOf(further, "Available")).toEqual(["stall-count"]);
  });

  it.each([
    ["Failure limit", "failure-limit"],
    ["Further-work limit", "further-work-limit"],
  ] as const)("adds no note at the %s when the end is external", (_label, cause) => {
    for (const actions of [
      [action("expected-end")],
      [action("other-end")],
      [action("unresolved")],
    ]) {
      expect(resumeNotesOf(context({ cause, actions }), "Available")).toEqual([]);
    }
  });

  it("adds no note for a pause by a human", () => {
    expect(resumeNotesOf(context({ cause: "human" }), "Available")).toEqual([]);
  });
});

describe("choosesTarget", () => {
  it("offers the choice only when the target decides the end", () => {
    expect(choosesTarget({ kind: "available" })).toBe(true);
    expect(choosesTarget({ kind: "waiting" })).toBe(true);
    expect(choosesTarget({ kind: "pending", dependency: { name: "x" } })).toBe(true);
    expect(choosesTarget({ kind: "external-success" })).toBe(false);
    expect(choosesTarget({ kind: "external-failed" })).toBe(false);
    expect(choosesTarget({ kind: "external-requested", open: true })).toBe(false);
  });
});
