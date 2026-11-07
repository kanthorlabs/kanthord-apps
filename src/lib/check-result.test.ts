import { describe, expect, it } from "vitest";

import type {
  ExternalLink,
  MissionCheckResolution,
  MissionLinkCheck,
  MissionNodeCheckFailure,
  MissionNodeCheckResult,
} from "@/api/types";

import { checkLabelOf as labelOf, linkLabelsOf } from "./check-result";

function result(
  key: "pull_request" | "push",
  resolution: MissionCheckResolution,
): MissionNodeCheckResult {
  return { evidence_id: `evidence_${key}`, requirement_key: `repo.${key}`, resolution };
}

const FAILURE: MissionNodeCheckFailure = {
  evidence_id: "evidence_1",
  error: {
    error: { code: "system.operation.unknown", message: "Operation failed.", details: null },
    request_id: "request_1",
  },
};

function checkLabelOf(
  results: readonly MissionNodeCheckResult[],
  failures: readonly MissionNodeCheckFailure[] = [],
  linkUpdates: readonly MissionLinkCheck[] = [],
) {
  return labelOf({ results, failures, link_updates: linkUpdates });
}

describe("checkLabelOf", () => {
  it("names a merged pull request", () => {
    expect(checkLabelOf([result("pull_request", "expected-end")])).toBe("Merged");
  });

  it("names a pushed commit", () => {
    expect(checkLabelOf([result("push", "expected-end")])).toBe("Pushed");
  });

  it("names several delivered requests", () => {
    expect(
      checkLabelOf([result("pull_request", "expected-end"), result("push", "expected-end")]),
    ).toBe("Delivered");
  });

  it("names an unresolved request as not delivered yet", () => {
    expect(checkLabelOf([result("pull_request", "unresolved")])).toBe("Not delivered yet");
  });

  it("names a mix of delivered and unresolved requests as not delivered yet", () => {
    expect(
      checkLabelOf([result("pull_request", "expected-end"), result("push", "unresolved")]),
    ).toBe("Not delivered yet");
  });

  it("names any other end first", () => {
    expect(
      checkLabelOf([result("pull_request", "other-end"), result("push", "expected-end")]),
    ).toBe("Ended in another state");
  });

  it("names an answer without results as not delivered yet", () => {
    expect(checkLabelOf([])).toBe("Not delivered yet");
  });

  it("names no result when every request failed", () => {
    expect(checkLabelOf([], [FAILURE])).toBeNull();
  });

  it("names the results that arrived next to a failure", () => {
    expect(checkLabelOf([result("pull_request", "expected-end")], [FAILURE])).toBe("Merged");
  });
});

const ISSUE: ExternalLink = {
  kind: "github_issue",
  resource_identity: "conversation:github:kanthorlabs/kanthord",
  number: 42,
};

describe("linkLabelsOf", () => {
  it("states the admitted, duplicate and refused counts of each link", () => {
    expect(
      linkLabelsOf({
        results: [],
        failures: [],
        link_updates: [
          { external_link: ISSUE, admitted: 2, duplicate: 1, refused: 0 },
          {
            external_link: {
              kind: "jira_issue",
              resource_identity: "conversation:jira:acme",
              key: "KAN-7",
            },
            admitted: 0,
            duplicate: 0,
            refused: 3,
          },
        ],
      }),
    ).toEqual([
      "kanthorlabs/kanthord#42: 2 admitted, 1 duplicate, 0 refused",
      "Jira issue KAN-7: 0 admitted, 0 duplicate, 3 refused",
    ]);
  });

  it("states nothing for an answer with no link", () => {
    expect(linkLabelsOf({ results: [], failures: [], link_updates: [] })).toEqual([]);
  });
});

describe("checkLabelOf of a node with links only", () => {
  it("names no delivery when no request exists and a link answered", () => {
    expect(
      checkLabelOf([], [], [{ external_link: ISSUE, admitted: 1, duplicate: 0, refused: 0 }]),
    ).toBeNull();
  });
});
