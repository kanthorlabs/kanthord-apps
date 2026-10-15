import { describe, expect, it } from "vitest";

import type { MissionExternalAction, RepositoryActionName } from "@/api/types";

import { unresolvedRequestsOf, unresolvedRequestsText } from "./external-requests";

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
    expect(unresolvedRequestsText(2, [action("pull_request", "unresolved")])).toBe(
      "Attempt 2 has an unresolved pull request. Override and discard wait for its end state. Resume the node.",
    );
  });

  it("names one push", () => {
    expect(unresolvedRequestsText(3, [action("merge_push", "unresolved")])).toBe(
      "Attempt 3 has an unresolved push to the base branch. Override and discard wait for its end state. Resume the node.",
    );
  });

  it("counts several requests", () => {
    expect(
      unresolvedRequestsText(1, [
        action("pull_request", "unresolved"),
        action("merge_push", "unresolved"),
      ]),
    ).toBe(
      "Attempt 1 has 2 unresolved requests. Override and discard wait for their end states. Resume the node.",
    );
  });
});
