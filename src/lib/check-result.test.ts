import { describe, expect, it } from "vitest";

import type {
  MissionCheckResolution,
  MissionNodeCheckFailure,
  MissionNodeCheckResult,
} from "@/api/types";

import { checkLabelOf as labelOf } from "./check-result";

function result(
  key: "pull_request" | "merge_push",
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
) {
  return labelOf({ results, failures });
}

describe("checkLabelOf", () => {
  it("names a merged pull request", () => {
    expect(checkLabelOf([result("pull_request", "expected-end")])).toBe("Merged");
  });

  it("names a pushed commit", () => {
    expect(checkLabelOf([result("merge_push", "expected-end")])).toBe("Pushed");
  });

  it("names several delivered requests", () => {
    expect(
      checkLabelOf([result("pull_request", "expected-end"), result("merge_push", "expected-end")]),
    ).toBe("Delivered");
  });

  it("names an unresolved request as not delivered yet", () => {
    expect(checkLabelOf([result("pull_request", "unresolved")])).toBe("Not delivered yet");
  });

  it("names a mix of delivered and unresolved requests as not delivered yet", () => {
    expect(
      checkLabelOf([result("pull_request", "expected-end"), result("merge_push", "unresolved")]),
    ).toBe("Not delivered yet");
  });

  it("names any other end first", () => {
    expect(
      checkLabelOf([result("pull_request", "other-end"), result("merge_push", "expected-end")]),
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
