import { describe, expect, it } from "vitest";

import { returnToOf, returnToState } from "./return-to";

describe("returnToOf", () => {
  it("reads the path of the router state", () => {
    expect(returnToOf(returnToState("/"))).toBe("/");
    expect(returnToOf({ return_to: "/projects/prj-1?tab=bindings" })).toBe(
      "/projects/prj-1?tab=bindings",
    );
  });

  it("refuses a foreign URL", () => {
    expect(returnToOf({ return_to: "https://evil.example/" })).toBeNull();
    expect(returnToOf({ return_to: "//evil.example/" })).toBeNull();
    expect(returnToOf({ return_to: "/\\evil.example/" })).toBeNull();
    expect(returnToOf({ return_to: "javascript:alert(1)" })).toBeNull();
    expect(returnToOf({ return_to: "/\t/evil.example/" })).toBeNull();
    expect(returnToOf({ return_to: "/\n/evil.example/" })).toBeNull();
    expect(returnToOf({ return_to: "/\r/evil.example/" })).toBeNull();
  });

  it("keeps an encoded slash pair inside the local path", () => {
    expect(returnToOf({ return_to: "/%2F%2Fevil.example" })).toBe("/%2F%2Fevil.example");
  });

  it("refuses a state without a path", () => {
    expect(returnToOf(null)).toBeNull();
    expect(returnToOf(undefined)).toBeNull();
    expect(returnToOf("/")).toBeNull();
    expect(returnToOf({ priorCheck: "ok" })).toBeNull();
    expect(returnToOf({ return_to: 1 })).toBeNull();
  });
});
