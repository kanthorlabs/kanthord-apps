import { describe, expect, it } from "vitest";

import {
  actorText,
  assetText,
  requestText,
  verificationPasses,
  verificationResultText,
} from "./mission-labels";

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

  it("counts the bytes of an object asset in the singular and the plural", () => {
    const asset = {
      id: "evidence_asset_2",
      kind: "object",
      address: { kind: "object", location: "out/report.txt" },
      storage_binding_id: "storage_1",
      media_type: "text/plain",
      published_at: 1,
      expired_at: null,
    } as const;
    expect(assetText({ ...asset, size: 1 })).toBe("object out/report.txt, 1 byte");
    expect(assetText({ ...asset, size: 2 })).toBe("object out/report.txt, 2 bytes");
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

  it("states a request with its assets and its end state", () => {
    const request = {
      id: "evidence_1",
      node_id: "node_1",
      attempt: 2,
      subject: "Open the pull request",
      assets: [
        {
          id: "evidence_asset_1",
          kind: "platform" as const,
          address: {
            kind: "pull_request" as const,
            resource_identity: "repository:github:a/b",
            number: 7,
          },
          published_at: 1,
          expired_at: null,
        },
      ],
      provenance: { kind: "human" as const, account: "ulrich", name: "Ulrich" },
      created_at: 1,
      requirement_key: "repo.pull_request",
      end_state: "expected" as const,
    };

    expect(requestText(request)).toBe(
      "repo.pull_request: Open the pull request, pull request #7 on repository:github:a/b. End state expected.",
    );
    expect(
      requestText({ ...request, assets: [], requirement_key: undefined, end_state: undefined }),
    ).toBe("request: Open the pull request. End state not set.");
  });
});
