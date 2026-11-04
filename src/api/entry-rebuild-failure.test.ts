import { describe, expect, it } from "vitest";

import { entryRebuildFailure } from "./entry-rebuild-failure";
import { ApiError } from "./errors";

describe("entryRebuildFailure", () => {
  it("names the instance and the reason of an unreachable instance", () => {
    const error = new ApiError(
      "unavailable",
      "The worker instance cannot serve the session read now.",
      503,
      "tracking.entry.unreachable",
      { instance: "laptop", placement: "worker", reason: "busy" },
    );
    expect(entryRebuildFailure(error)).toBe(
      "The worker instance laptop serves 8 reads now. Try again.",
    );
  });

  it("keeps the message of an unknown reason", () => {
    const error = new ApiError(
      "unavailable",
      "The worker instance cannot serve the session read now.",
      503,
      "tracking.entry.unreachable",
      { instance: "laptop", placement: "worker", reason: "later" },
    );
    expect(entryRebuildFailure(error)).toBe(
      "The worker instance cannot serve the session read now.",
    );
  });

  it("keeps the message of any other failure", () => {
    const error = new ApiError(
      "not_found",
      "The session entry is unknown.",
      404,
      "tracking.entry.not_found",
    );
    expect(entryRebuildFailure(error)).toBe("The session entry is unknown.");
  });
});
