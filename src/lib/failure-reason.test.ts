import { describe, expect, it } from "vitest";

import type { CredentialComponent, ResourceFailureReason } from "@/api/types";
import {
  failureReasonHint,
  failureReasonHintOf,
  healthEntryHint,
  instanceCopyHint,
} from "./failure-reason";

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
  "host_key_changed",
  "identity_unavailable",
  "held_by_instance",
  "deadline_exceeded",
  "unclassified",
];

const HTTP_REASONS: readonly ResourceFailureReason[] = [
  "unauthorized",
  "forbidden",
  "rate_limited",
  "unreachable",
  "invalid_response",
];

const COMPONENTS: readonly CredentialComponent[] = ["llm", "repository", "storage"];

describe("failure reason hint", () => {
  it("gives each current value its own hint in each component", () => {
    for (const component of COMPONENTS) {
      const hints = REASONS.map((reason) => failureReasonHint(reason, component));
      expect(new Set(hints).size).toBe(REASONS.length);
    }
  });

  it("names the worker instance for a copy that an instance holds", () => {
    expect(failureReasonHint("held_by_instance", "llm")).toBe(
      "A worker instance holds the copy. The server holds no secret to check.",
    );
  });

  it("points an instance copy to the instance and never to a verify", () => {
    expect(instanceCopyHint("unreachable")).toContain("network of the instance host");
    expect(instanceCopyHint("unclassified")).toContain("log of the instance");
    for (const reason of [
      "unauthorized",
      "forbidden",
      "rate_limited",
      "unreachable",
      "invalid_response",
      "deadline_exceeded",
      "unclassified",
    ])
      expect(instanceCopyHint(reason)).not.toMatch(/[Vv]erify/);
    expect(instanceCopyHint("held_by_instance")).toBe(failureReasonHint("held_by_instance", "llm"));
  });

  it("names the deadline for a check of every component that exceeds it", () => {
    for (const component of COMPONENTS)
      expect(failureReasonHint("deadline_exceeded", component)).toBe(
        "The remote host or service did not answer before the check deadline. Verify again. If the failure stays, check the network of the server.",
      );
  });

  it("names the deadline only in the deadline_exceeded hint", () => {
    for (const component of COMPONENTS)
      for (const reason of REASONS.filter((value) => value !== "deadline_exceeded"))
        expect(failureReasonHint(reason, component)).not.toMatch(/deadline/);
    for (const reason of [...HTTP_REASONS, "unclassified"])
      expect(instanceCopyHint(reason)).not.toMatch(/deadline/);
  });

  it("gives the unclassified hint with no deadline cause", () => {
    expect(failureReasonHint("unclassified", "repository")).toBe(
      "The check failed for an unknown cause. Verify again. If the failure stays, read the server log.",
    );
    expect(instanceCopyHint("unclassified")).toBe(
      "The check failed for an unknown cause. Read the log of the instance.",
    );
  });

  it("points an instance copy past its deadline to the instance host", () => {
    expect(instanceCopyHint("deadline_exceeded")).toBe(
      "The provider did not answer before the check deadline. Check the network of the instance host. The instance checks the copy again after the next copy write.",
    );
  });

  it("names the deploy key step for a refused key", () => {
    expect(failureReasonHint("key_refused", "repository")).toContain("deploy key");
  });

  it("names the host key for an unknown host key", () => {
    expect(failureReasonHint("host_key_unknown", "repository")).toContain("host key");
  });

  it("names the pin flow of the binding sheet for an unknown host key", () => {
    expect(failureReasonHint("host_key_unknown", "repository")).toBe(
      "Open the binding. The sheet pins the host key, or shows Confirm host key. Then verify again.",
    );
  });

  it("gives the hint of a changed host key", () => {
    expect(failureReasonHint("host_key_changed", "repository")).toBe(
      "The host presented another key. Compare the fingerprint with the published one, then pin again.",
    );
  });

  it("gives the ruled hint of an unavailable SSH identity", () => {
    expect(failureReasonHint("identity_unavailable", "repository")).toBe(
      "The server cannot load the SSH key. Rotate the key. If the fault stays, read the server log.",
    );
  });

  it("gives the LLM hints of the HTTP values", () => {
    expect(failureReasonHint("unauthorized", "llm")).toBe(
      "The provider refused the API key or the access token. Correct the key, or sign in again for a new token. Then verify again.",
    );
    expect(failureReasonHint("forbidden", "llm")).toBe(
      "The provider accepted the key or the token but refused the access. Check the permissions and the plan of the account.",
    );
    expect(failureReasonHint("rate_limited", "llm")).toBe(
      "The provider limited the requests. Wait some minutes, or check the quota of the plan. Then verify again.",
    );
    expect(failureReasonHint("unreachable", "llm")).toBe(
      "The server cannot reach the provider. Check the network of the server and the base URL of an openai-compatible credential. For an OAuth platform, sign in again.",
    );
    expect(failureReasonHint("invalid_response", "llm")).toBe(
      "The provider sent an answer that the check does not expect, for example a server error. Verify again later. For an openai-compatible credential, check that the base URL points to the API of the provider.",
    );
  });

  it("gives the repository and the storage hints of the HTTP values", () => {
    for (const component of ["repository", "storage"] as const) {
      expect(failureReasonHint("unauthorized", component)).toBe(
        "The remote service refused the token or the access key. Correct the token or the key. Then verify again.",
      );
      expect(failureReasonHint("forbidden", component)).toBe(
        "The remote service accepted the token or the key but refused the access. Check the permissions of the token or the key.",
      );
      expect(failureReasonHint("rate_limited", component)).toBe(
        "The remote service limited the requests. Wait some minutes, or check the quota of the account. Then verify again.",
      );
      expect(failureReasonHint("unreachable", component)).toBe(
        "The server cannot reach the remote service. Check the network of the server and the endpoint of a storage credential.",
      );
      expect(failureReasonHint("invalid_response", component)).toBe(
        "The remote service sent an answer that the check does not expect, for example a server error. Verify again later. For a storage credential, check the endpoint and the bucket.",
      );
    }
  });

  it("uses no LLM words in a repository or a storage hint", () => {
    for (const component of ["repository", "storage"] as const) {
      for (const reason of HTTP_REASONS) {
        expect(failureReasonHint(reason, component)).not.toMatch(/provider|base URL|sign in/);
      }
    }
  });

  it("names the key or the token step for a refused secret", () => {
    expect(failureReasonHint("unauthorized", "llm")).toMatch(/key|token/);
  });

  it("names the wait or the plan quota for a rate limit", () => {
    expect(failureReasonHint("rate_limited", "llm")).toMatch(/[Ww]ait/);
    expect(failureReasonHint("rate_limited", "llm")).toContain("quota");
  });

  it("names the network or the endpoint for an unreachable provider", () => {
    expect(failureReasonHint("unreachable", "llm")).toMatch(/network|base URL/);
  });

  it("falls back for a value that the client does not know and names the value", () => {
    for (const component of COMPONENTS) {
      const hint = failureReasonHint("host_key_moved", component);
      expect(REASONS.map((reason) => failureReasonHint(reason, component))).not.toContain(hint);
      expect(hint).toContain("host_key_moved");
    }
  });

  it("reads the repository hint from the details of a refusal", () => {
    expect(failureReasonHintOf({ failure_reason: "key_refused" })).toBe(
      failureReasonHint("key_refused", "repository"),
    );
  });

  it("gives no hint when the details carry no failure reason", () => {
    expect(failureReasonHintOf(null)).toBeNull();
    expect(failureReasonHintOf({})).toBeNull();
    expect(failureReasonHintOf({ failure_reason: 7 })).toBeNull();
    expect(failureReasonHintOf("key_refused")).toBeNull();
  });

  it("gives the hint of an entry in the words of its component", () => {
    const entry = {
      status: "unhealthy",
      capability: "c",
      failure_reason: "unauthorized",
    } as const;
    expect(healthEntryHint(entry, "llm")).toBe(failureReasonHint("unauthorized", "llm"));
    expect(healthEntryHint(entry, "storage")).toBe(failureReasonHint("unauthorized", "storage"));
    expect(
      healthEntryHint({ status: "healthy", capability: "c", failure_reason: null }, "llm"),
    ).toBeNull();
  });
});
