import { describe, expect, it } from "vitest";

import { ApiError, isApiError, isRouteAbsent } from "./errors";

describe("ApiError", () => {
  it("carries the code, the status and the detail across the boundary", () => {
    const error = new ApiError("conflict", "The expected revision is superseded.", 409, "rev-pr-3");
    expect(error.code).toBe("conflict");
    expect(error.status).toBe(409);
    expect(error.detail).toBe("rev-pr-3");
    expect(error.message).toBe("The expected revision is superseded.");
  });

  it("is recognisable after it crosses the boundary", () => {
    expect(isApiError(new ApiError("not_found", "No such node.", 404))).toBe(true);
    expect(isApiError(new Error("No such node."))).toBe(false);
  });
});

describe("isRouteAbsent", () => {
  it("is true for a 404 that names the gateway routing code", () => {
    expect(
      isRouteAbsent(new ApiError("not_found", "No route.", 404, "gateway.routing.not_found")),
    ).toBe(true);
  });

  it("is false for a 404 with another code", () => {
    expect(
      isRouteAbsent(new ApiError("not_found", "No node.", 404, "mission.node.not_found")),
    ).toBe(false);
  });

  it("is false for a 503", () => {
    expect(
      isRouteAbsent(new ApiError("unavailable", "Down.", 503, "gateway.routing.not_found")),
    ).toBe(false);
  });
});
