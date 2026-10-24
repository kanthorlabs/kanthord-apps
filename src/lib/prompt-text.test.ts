import { describe, expect, it } from "vitest";

import { byteUsage, promptTextProblem, utf8Bytes } from "./prompt-text";

describe("prompt text", () => {
  it("counts UTF-8 bytes, not characters", () => {
    expect(utf8Bytes("abc")).toBe(3);
    expect(utf8Bytes("é")).toBe(2);
  });

  it("states the usage against the limit", () => {
    expect(byteUsage("é".repeat(600))).toBe("1,200 / 32,768 bytes");
  });

  it("accepts tab and line feed and names a text above the limit", () => {
    expect(promptTextProblem("a\tb\nc")).toBeNull();
    expect(promptTextProblem("a".repeat(32769))).toBe("The text is above the limit.");
  });

  it("names a control character", () => {
    expect(promptTextProblem("a\u0007b")).toMatch(/control character/);
    expect(promptTextProblem("a\r\nb")).toMatch(/control character/);
    expect(promptTextProblem("a\u007Fb")).toMatch(/control character/);
  });
});
