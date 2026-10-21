import { describe, expect, it } from "vitest";

import type { Credential } from "@/api/types";
import { newestSshKeyOf, sshKeyOf } from "./ssh-key";

const KEY = {
  public_key: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIA kanthord-atlas-ssh",
  fingerprint: "SHA256:uNiVztksCsDhcc0u9e8BujQXVUpKZIDTMczCvj3tD2s",
};

function revision(revision: number, metadata: Readonly<Record<string, unknown>> | null) {
  return { id: `rev_${revision}`, revision, metadata, created_at: revision, ended_at: null };
}

describe("sshKeyOf", () => {
  it("reads the public key and the fingerprint of a generated key", () => {
    expect(sshKeyOf(KEY)).toEqual(KEY);
  });

  it("answers null for a legacy record and for no metadata", () => {
    expect(sshKeyOf({ host: "github.com", identity_file: "~/.ssh/id_atlas" })).toBeNull();
    expect(sshKeyOf(null)).toBeNull();
  });
});

describe("newestSshKeyOf", () => {
  it("reads the key of the newest live revision", () => {
    const credential: Credential = {
      name: "atlas-ssh",
      platform: "ssh",
      holder: "server",
      sealed_to: null,
      sealed_current: true,
      revisions: [revision(2, { ...KEY, fingerprint: "SHA256:new" }), revision(1, KEY)],
    };
    expect(newestSshKeyOf(credential)?.fingerprint).toBe("SHA256:new");
  });
});
