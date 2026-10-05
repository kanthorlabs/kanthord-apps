import { describe, expect, it } from "vitest";

import { sshAliasToName } from "./ssh-name";

describe("sshAliasToName", () => {
  it("lower-cases the alias", () => {
    expect(sshAliasToName("GitHub.com")).toBe("github-com");
  });

  it("replaces dots with hyphens", () => {
    expect(sshAliasToName("github.com")).toBe("github-com");
  });

  it("replaces underscores and spaces with hyphens", () => {
    expect(sshAliasToName("my_host name")).toBe("my-host-name");
  });

  it("prefixes a leading digit with ssh-", () => {
    expect(sshAliasToName("1.2.3.4")).toBe("ssh-1-2-3-4");
  });

  it("prefixes a leading hyphen with ssh-", () => {
    expect(sshAliasToName("-host")).toBe("ssh--host");
  });

  it("leaves a valid name unchanged", () => {
    expect(sshAliasToName("my-host")).toBe("my-host");
  });

  it("truncates to 63 characters", () => {
    const alias = "a".repeat(80);
    expect(sshAliasToName(alias)).toHaveLength(63);
  });

  it("truncates after prefixing", () => {
    const alias = "9" + "a".repeat(80);
    const result = sshAliasToName(alias);
    expect(result.startsWith("ssh-9")).toBe(true);
    expect(result).toHaveLength(63);
  });
});
