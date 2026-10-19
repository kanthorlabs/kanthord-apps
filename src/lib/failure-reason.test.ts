import { describe, expect, it } from "vitest";

import type { ResourceFailureReason } from "@/api/types";
import { failureReasonHint, failureReasonHintOf, healthEntryHint } from "./failure-reason";

const REASONS: readonly ResourceFailureReason[] = [
  "host_key_unknown",
  "key_refused",
  "repository_not_found",
  "host_unreachable",
  "address_invalid",
  "unauthorized",
  "forbidden",
  "rate_limited",
  "unreachable",
  "invalid_response",
  "unclassified",
];

describe("failure reason hint", () => {
  it("gives each current value its own hint", () => {
    const hints = REASONS.map(failureReasonHint);
    expect(new Set(hints).size).toBe(REASONS.length);
  });

  it("names the deploy key step for a refused key", () => {
    expect(failureReasonHint("key_refused")).toContain("deploy key");
  });

  it("names the host key for an unknown host key", () => {
    expect(failureReasonHint("host_key_unknown")).toContain("host key");
  });

  it("names the key or the token step for a refused secret", () => {
    expect(failureReasonHint("unauthorized")).toMatch(/key|token/);
  });

  it("names the wait or the plan quota for a rate limit", () => {
    expect(failureReasonHint("rate_limited")).toMatch(/[Ww]ait/);
    expect(failureReasonHint("rate_limited")).toContain("quota");
  });

  it("names the network or the endpoint for an unreachable provider", () => {
    expect(failureReasonHint("unreachable")).toMatch(/network|endpoint/);
  });

  it("falls back for a value that the client does not know and names the value", () => {
    const hint = failureReasonHint("host_key_changed");
    expect(REASONS.map(failureReasonHint)).not.toContain(hint);
    expect(hint).toContain("host_key_changed");
  });

  it("reads the hint from the details of a refusal", () => {
    expect(failureReasonHintOf({ failure_reason: "key_refused" })).toBe(
      failureReasonHint("key_refused"),
    );
  });

  it("gives no hint when the details carry no failure reason", () => {
    expect(failureReasonHintOf(null)).toBeNull();
    expect(failureReasonHintOf({})).toBeNull();
    expect(failureReasonHintOf({ failure_reason: 7 })).toBeNull();
    expect(failureReasonHintOf("key_refused")).toBeNull();
  });

  it("gives the hint of an entry that carries a failure reason", () => {
    expect(
      healthEntryHint({ status: "unhealthy", capability: "c", failure_reason: "key_refused" }),
    ).toBe(failureReasonHint("key_refused"));
    expect(
      healthEntryHint({ status: "healthy", capability: "c", failure_reason: null }),
    ).toBeNull();
  });
});
