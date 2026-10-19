import { describe, expect, it } from "vitest";

import { publishedFingerprintsUrl } from "./published-fingerprints";

describe("publishedFingerprintsUrl", () => {
  it("names the page of the provider for each host of an SSH host set", () => {
    expect(publishedFingerprintsUrl("gitlab.com")).toMatch(/^https:\/\/docs\.gitlab\.com\//);
    expect(publishedFingerprintsUrl("altssh.gitlab.com")).toBe(
      publishedFingerprintsUrl("gitlab.com"),
    );
    expect(publishedFingerprintsUrl("bitbucket.org")).toMatch(/atlassian\.com/);
    expect(publishedFingerprintsUrl("ssh.github.com")).toMatch(/docs\.github\.com/);
  });

  it("answers null for another host", () => {
    expect(publishedFingerprintsUrl("git.example.com")).toBeNull();
  });
});
