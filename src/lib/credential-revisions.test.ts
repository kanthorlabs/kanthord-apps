import { describe, expect, it } from "vitest";

import type { Credential } from "@/api/types";
import {
  isArchived,
  isRevocable,
  liveRevisionCount,
  newestLiveRevision,
  revisionsNewestFirst,
} from "./credential-revisions";

function revision(number: number, endedAt: number | null) {
  return {
    id: `credential_${number}`,
    revision: number,
    metadata: null,
    createdAt: number,
    endedAt,
  };
}

const CREDENTIAL: Credential = {
  name: "ci-github",
  platform: "github",
  revisions: [revision(3, null), revision(2, null), revision(1, 5)],
};

describe("credential revisions", () => {
  it("finds the newest live revision", () => {
    expect(newestLiveRevision(CREDENTIAL)?.revision).toBe(3);
    expect(liveRevisionCount(CREDENTIAL)).toBe(2);
  });

  it("revokes only an older live revision", () => {
    const [third, second, first] = CREDENTIAL.revisions;
    expect(isRevocable(CREDENTIAL, third!)).toBe(false);
    expect(isRevocable(CREDENTIAL, second!)).toBe(true);
    expect(isRevocable(CREDENTIAL, first!)).toBe(false);
  });

  it("derives the archived state from a record without a live revision", () => {
    const ended = { ...CREDENTIAL, revisions: [revision(2, 7), revision(1, 5)] };
    expect(isArchived(CREDENTIAL)).toBe(false);
    expect(isArchived(ended)).toBe(true);
  });

  it("orders the revisions newest first", () => {
    const shuffled = {
      ...CREDENTIAL,
      revisions: [revision(1, 5), revision(3, null), revision(2, null)],
    };
    expect(revisionsNewestFirst(shuffled).map((entry) => entry.revision)).toEqual([3, 2, 1]);
  });
});
