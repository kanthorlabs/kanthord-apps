import { describe, expect, it } from "vitest";

import { actorText, assetText, verificationPasses, verificationResultText } from "./mission-labels";

describe("mission labels", () => {
  it("names each actor form", () => {
    expect(actorText({ kind: "human", account: "ulrich", name: "Ulrich" })).toBe("Ulrich (ulrich)");
    expect(
      actorText({ kind: "execution", execution_id: "execution_1", client_id: null, name: null }),
    ).toBe("execution_1");
    expect(
      actorText({ kind: "service", service: "mission", inbound_event_id: "inbound_event_1" }),
    ).toBe("mission service (inbound_event_1)");
  });

  it("names a pull request asset by its number and resource", () => {
    expect(
      assetText({
        id: "evidence_asset_1",
        kind: "platform",
        address: { kind: "pull_request", resource_identity: "repository:github:a/b", number: 7 },
        published_at: 1,
        expired_at: null,
      }),
    ).toBe("pull request #7 on repository:github:a/b");
  });

  it("states how a verification command ended", () => {
    const base = { command: "pnpm test", exit_code: 0, signal: null, timed_out: false };
    expect(verificationResultText(base)).toBe("passed");
    expect(verificationResultText({ ...base, exit_code: 2 })).toBe("failed with exit code 2");
    expect(verificationResultText({ ...base, exit_code: null, timed_out: true })).toBe("timed out");
    expect(verificationResultText({ ...base, exit_code: null })).toBe("did not run");
  });

  it("passes a verification only when every command exits 0", () => {
    const testedInput = { kind: "produced" as const, sha256: "a".repeat(64) };
    const ok = { command: "a", exit_code: 0, signal: null, timed_out: false };
    expect(verificationPasses({ tested_input: testedInput, results: [ok] })).toBe(true);
    expect(
      verificationPasses({ tested_input: testedInput, results: [ok, { ...ok, exit_code: 1 }] }),
    ).toBe(false);
  });
});
