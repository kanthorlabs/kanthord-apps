import { describe, expect, it } from "vitest";

import { ApiError, isApiError } from "./errors";

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
