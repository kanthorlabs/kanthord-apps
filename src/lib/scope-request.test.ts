import { describe, expect, it } from "vitest";

import {
  ageTextOf,
  expectedAvailable,
  expectedOf,
  requestAgeLineOf,
  utcDateOf,
} from "./scope-request";

const NODE = { state: "Blocked", attempt: 2, visible_revision: 4 } as const;

describe("ageTextOf", () => {
  it.each([
    [0, "0 min"],
    [3 * 60_000 + 59_000, "3 min"],
    [59 * 60_000, "59 min"],
    [60 * 60_000, "1 h"],
    [23 * 3_600_000 + 59 * 60_000, "23 h"],
    [24 * 3_600_000, "1 d"],
    [3 * 86_400_000 + 5 * 3_600_000, "3 d"],
  ])("reads %i ms as %s", (age, text) => {
    expect(ageTextOf(1_000, 1_000 + age)).toBe(text);
  });

  it("reads a creation time in the future as 0 min", () => {
    expect(ageTextOf(5_000, 1_000)).toBe("0 min");
  });
});

describe("requestAgeLineOf", () => {
  it("names the age and the UTC date of the expiry", () => {
    const request = {
      created_at: Date.parse("2026-10-05T09:00:00.000Z"),
      expires_at: Date.parse("2026-10-12T23:59:00.000Z"),
    };

    expect(requestAgeLineOf(request as never, Date.parse("2026-10-05T09:03:00.000Z"))).toBe(
      "Requested 3 min ago · ends with the invite on 2026-10-12",
    );
    expect(utcDateOf(request.expires_at)).toBe("2026-10-12");
  });
});

describe("expected keys", () => {
  it("fills each known key from the reads", () => {
    expect(
      expectedOf(
        [
          "expected_mission_version",
          "expected_state",
          "expected_attempt",
          "expected_revision",
          "blocked_attempt",
        ],
        { missionVersion: 7, node: NODE },
      ),
    ).toEqual({
      expected_mission_version: 7,
      expected_state: "Blocked",
      expected_attempt: 2,
      expected_revision: 4,
      blocked_attempt: 2,
    });
  });

  it("accepts known keys and refuses an unknown key", () => {
    expect(expectedAvailable(["expected_mission_version"], false)).toBe(true);
    expect(expectedAvailable([], false)).toBe(true);
    expect(expectedAvailable(["expected_mission_version", "expected_other"], true)).toBe(false);
  });

  it("refuses a node key when the request names no node", () => {
    expect(expectedAvailable(["expected_state"], false)).toBe(false);
    expect(expectedAvailable(["expected_state"], true)).toBe(true);
  });

  it("throws for a node key with no node read", () => {
    expect(() => expectedOf(["expected_state"], { missionVersion: 1, node: null })).toThrow();
  });
});
