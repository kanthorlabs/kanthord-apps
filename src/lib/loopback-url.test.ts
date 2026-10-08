import { describe, expect, it } from "vitest";

import { isLoopbackUrl } from "./loopback-url";

describe("isLoopbackUrl", () => {
  it("accepts a loopback name with or without a port", () => {
    for (const url of [
      "http://localhost:31415",
      "http://LOCALHOST",
      "http://127.0.0.1:31415",
      "http://127.0.0.2",
      "http://[::1]:31415",
    ]) {
      expect(isLoopbackUrl(url)).toBe(true);
    }
  });

  it("refuses every other host and a malformed address", () => {
    for (const url of [
      "http://192.168.1.64:31415",
      "https://mac.tailnet.ts.net",
      "http://localhost.example.com",
      "not a url",
    ]) {
      expect(isLoopbackUrl(url)).toBe(false);
    }
  });
});
