import { describe, expect, it } from "vitest";

import { byteUsage, utf8Bytes } from "./prompt-text";

describe("prompt text", () => {
  it("counts UTF-8 bytes, not characters", () => {
    expect(utf8Bytes("abc")).toBe(3);
    expect(utf8Bytes("é")).toBe(2);
  });

  it("states the usage against the limit", () => {
    expect(byteUsage("é".repeat(600))).toBe("1,200 / 32,768 bytes");
  });
});
