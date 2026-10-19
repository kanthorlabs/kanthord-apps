import { describe, expect, it } from "vitest";

import { healthLabel, healthVariant } from "./credential-health";

describe("credential health badge", () => {
  it("labels every resource status as text", () => {
    expect(
      healthLabel({ status: "healthy", capability: "rate-limit read", failure_reason: null }),
    ).toBe("Healthy");
    expect(
      healthLabel({
        status: "unhealthy",
        capability: "rate-limit read",
        failure_reason: "unclassified",
      }),
    ).toBe("Unhealthy");
    expect(
      healthLabel({ status: "unknown", capability: "bucket head", failure_reason: "unclassified" }),
    ).toBe("Unknown");
  });

  it("picks a stock variant", () => {
    expect(healthVariant({ status: "healthy", capability: "c", failure_reason: null })).toBe(
      "default",
    );
    expect(
      healthVariant({ status: "unhealthy", capability: "c", failure_reason: "unclassified" }),
    ).toBe("destructive");
    expect(
      healthVariant({ status: "unknown", capability: "c", failure_reason: "unclassified" }),
    ).toBe("outline");
  });
});
