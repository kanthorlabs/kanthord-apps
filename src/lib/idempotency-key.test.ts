import { describe, expect, it } from "vitest";

import { newIdempotencyKey } from "./idempotency-key";

const IDEMPOTENCY_KEY = /^idempotency_key_[0-7][0-9A-HJKMNP-TV-Z]{25}$/;

describe("newIdempotencyKey", () => {
  it("matches the Idempotency-Key pattern of the contract", () => {
    expect(newIdempotencyKey()).toMatch(IDEMPOTENCY_KEY);
  });

  it("answers a new key on each call", () => {
    expect(newIdempotencyKey()).not.toBe(newIdempotencyKey());
  });
});
