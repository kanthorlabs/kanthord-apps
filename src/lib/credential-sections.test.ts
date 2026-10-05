import { describe, expect, it } from "vitest";

import { credentialDetailPath, credentialSectionPath } from "./credential-sections";

describe("credentialSectionPath", () => {
  it("maps each component to its dashboard section", () => {
    expect(credentialSectionPath("llm")).toBe("/llm");
    expect(credentialSectionPath("repository")).toBe("/repositories");
    expect(credentialSectionPath("storage")).toBe("/storage");
  });
});

describe("credentialDetailPath", () => {
  it("encodes the credential name under the section", () => {
    expect(credentialDetailPath("repository", "ci github")).toBe("/repositories/ci%20github");
  });
});
