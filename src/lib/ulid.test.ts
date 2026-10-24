import { describe, expect, it } from "vitest";

import { newUlid } from "./ulid";

const CANONICAL_ULID = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;

describe("newUlid", () => {
  it("matches the canonical ULID pattern", () => {
    expect(newUlid()).toMatch(CANONICAL_ULID);
  });

  it("encodes the time in the first ten characters", () => {
    expect(newUlid(0).slice(0, 10)).toBe("0000000000");
    expect(newUlid(1_469_918_176_385).slice(0, 10)).toBe("01ARYZ6S41");
  });

  it("differs between two calls in the same millisecond", () => {
    expect(newUlid(1)).not.toBe(newUlid(1));
  });
});
