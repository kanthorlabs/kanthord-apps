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
    expect(entryRebuildFailure(error)).toEqual({
      lead: "The worker instance ",
      instance: "laptop",
      tail: " serves 8 reads now. Try again.",
    });
  });

  it("keeps the message of an unknown reason", () => {
    const error = new ApiError(
      "unavailable",
      "The worker instance cannot serve the session read now.",
      503,
      "tracking.entry.unreachable",
      { instance: "laptop", placement: "worker", reason: "later" },
    );
    expect(entryRebuildFailure(error)).toEqual({
      lead: "The worker instance cannot serve the session read now.",
      instance: null,
      tail: "",
    });
  });

  it("keeps the message of any other failure", () => {
    const error = new ApiError(
      "not_found",
      "The session entry is unknown.",
      404,
      "tracking.entry.not_found",
    );
    expect(entryRebuildFailure(error)).toEqual({
      lead: "The session entry is unknown.",
      instance: null,
      tail: "",
    });
  });
});
