import { describe, expect, it } from "vitest";

import { missingHint } from "./missing-fields";

describe("missingHint", () => {
  it("lists the missing fields with their purpose", () => {
    expect(missingHint([], "save")).toBeNull();
    expect(missingHint(["Name"], "save")).toBe("Fill Name to save.");
    expect(missingHint(["Name", "API key", "baseUrl"], "verify and create")).toBe(
      "Fill Name, API key and baseUrl to verify and create.",
    );
  });
});
