import { describe, expect, it } from "vitest";

import {
  INVALID_BASE_URL,
  normalizeBaseUrl,
  validateEdit,
  validateSignIn,
} from "./instance-validation";

const LOCAL = { id: "i-1", name: "local", baseUrl: "http://localhost:31415" };
const STAGING = { id: "i-2", name: "staging", baseUrl: "https://kd.example.com" };

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

describe("validateSignIn", () => {
  it("names the instance after its endpoint when the name is empty", () => {
    expect(
      validateSignIn({ name: " ", baseUrl: "https://kd.example.com/", token: " jwt-1 " }, []),
    ).toEqual({
      errors: null,
      fields: { name: "https://kd.example.com", baseUrl: "https://kd.example.com", token: "jwt-1" },
      id: null,
    });
  });

  it("targets the saved instance that already uses the endpoint", () => {
    const result = validateSignIn(
      { name: "local", baseUrl: "http://localhost:31415/", token: "jwt-2" },
      [LOCAL, STAGING],
    );

    expect(result.errors).toBeNull();
    expect(result.id).toBe("i-1");
  });

  it("refuses a name that another endpoint uses", () => {
    expect(
      validateSignIn({ name: "STAGING", baseUrl: "http://localhost:31415", token: "jwt-1" }, [
        LOCAL,
        STAGING,
      ]).errors,
    ).toEqual({ name: "Another instance is already named STAGING." });
  });

  it("names every problem", () => {
    expect(validateSignIn({ name: "", baseUrl: "nope", token: "" }, []).errors).toEqual({
      baseUrl: INVALID_BASE_URL,
      token: "Paste a token.",
    });
  });
});

describe("validateEdit", () => {
  it("keeps the edited instance out of the duplicate checks", () => {
    expect(
      validateEdit(
        { name: "local", baseUrl: "http://localhost:31415", token: "jwt-1" },
        [LOCAL, STAGING],
        "i-1",
      ).errors,
    ).toBeNull();
  });

  it("refuses the endpoint of another instance", () => {
    expect(
      validateEdit(
        { name: "local", baseUrl: "https://kd.example.com", token: "jwt-1" },
        [LOCAL, STAGING],
        "i-1",
      ).errors,
    ).toEqual({ baseUrl: "The instance staging already uses this URL." });
  });
});
