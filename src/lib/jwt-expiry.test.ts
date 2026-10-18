import { describe, expect, it } from "vitest";

import { jwtExpiryOf } from "./jwt-expiry";

function tokenOf(payload: unknown): string {
  const encoded = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `header.${encoded}.signature`;
}

describe("jwtExpiryOf", () => {
  it("reads exp as milliseconds", () => {
    expect(jwtExpiryOf(tokenOf({ sub: "kanthorlabs", exp: 1_792_000_000 }))).toBe(
      1_792_000_000_000,
    );
  });

  it("decodes a base64url payload with non-ASCII text", () => {
    const encoded = btoa(
      String.fromCharCode(...new TextEncoder().encode('{"name":"Ülrich?>","exp":5}')),
    )
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    expect(jwtExpiryOf(`header.${encoded}.signature`)).toBe(5_000);
  });

  it("returns null when exp is absent or not a number", () => {
    expect(jwtExpiryOf(tokenOf({ sub: "kanthorlabs" }))).toBeNull();
    expect(jwtExpiryOf(tokenOf({ exp: "soon" }))).toBeNull();
    expect(jwtExpiryOf(tokenOf(null))).toBeNull();
  });

  it("returns null for a token that is not a JWT", () => {
    expect(jwtExpiryOf("not-a-token")).toBeNull();
    expect(jwtExpiryOf("a.%%%.c")).toBeNull();
    expect(jwtExpiryOf("a.bm90LWpzb24.c")).toBeNull();
    expect(jwtExpiryOf("")).toBeNull();
  });
});
