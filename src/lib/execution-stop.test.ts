import { describe, expect, it } from "vitest";

import { stopLabel } from "./execution-stop";

describe("stopLabel", () => {
  it("names the reason and the code of a provider failure", () => {
    expect(stopLabel({ reason: "provider_failed", code: "rate_limited" })).toBe(
      "Provider failed: rate limited",
    );
    expect(stopLabel({ reason: "provider_failed", code: "bad_request" })).toBe(
      "Provider failed: bad request",
    );
  });

  it("names the budget that ended", () => {
    expect(stopLabel({ reason: "budget_end", code: "wall_time" })).toBe("Budget ended: wall time");
    expect(stopLabel({ reason: "budget_end", code: "turns" })).toBe("Budget ended: turns");
  });

  it("names the reason alone when the code is null", () => {
    expect(stopLabel({ reason: "no_progress", code: null })).toBe("No progress");
  });

  it("keeps a free code of an operation failure as it is", () => {
    expect(stopLabel({ reason: "operation_failed", code: "repository.node_branch.missing" })).toBe(
      "Operation failed: repository.node_branch.missing",
    );
  });
});
