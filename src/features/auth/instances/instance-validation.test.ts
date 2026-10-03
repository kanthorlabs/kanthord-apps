import { describe, expect, it } from "vitest";

import { INVALID_BASE_URL, normalizeBaseUrl, validateDraft } from "./instance-validation";

const LOCAL = { id: "i-1", name: "local", baseUrl: "http://localhost:31415" };

describe("normalizeBaseUrl", () => {
  it("removes the trailing slash", () => {
    expect(normalizeBaseUrl(" http://localhost:31415/ ")).toBe("http://localhost:31415");
    expect(normalizeBaseUrl("https://kd.example.com/base/")).toBe("https://kd.example.com/base");
  });

  it("refuses a relative URL and a URL that is not http or https", () => {
    expect(normalizeBaseUrl("localhost:31415")).toBeNull();
    expect(normalizeBaseUrl("/api")).toBeNull();
    expect(normalizeBaseUrl("ftp://kd.example.com")).toBeNull();
  });
});

describe("validateDraft", () => {
  it("accepts a new name and a new URL", () => {
    expect(validateDraft({ name: "staging", baseUrl: "https://kd.example.com/" }, [LOCAL])).toEqual(
      { errors: null, baseUrl: "https://kd.example.com" },
    );
  });

  it("names every problem", () => {
    expect(validateDraft({ name: " ", baseUrl: "nope" }, []).errors).toEqual({
      name: "Type a name.",
      baseUrl: INVALID_BASE_URL,
    });
  });

  it("refuses a duplicate name in any case and a duplicate URL", () => {
    expect(
      validateDraft({ name: "LOCAL", baseUrl: "http://localhost:31415/" }, [LOCAL]).errors,
    ).toEqual({
      name: "Another instance is already named LOCAL.",
      baseUrl: "The instance local already uses this URL.",
    });
  });
});
