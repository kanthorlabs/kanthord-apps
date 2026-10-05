import { describe, expect, it } from "vitest";

import { healthLabel, healthVariant } from "./credential-health";

describe("credential health badge", () => {
  it("labels every resource status as text", () => {
    expect(healthLabel({ status: "healthy", capability: "rate-limit read" })).toBe("Healthy");
    expect(healthLabel({ status: "unhealthy", capability: "rate-limit read" })).toBe("Unhealthy");
    expect(healthLabel({ status: "unknown", capability: "bucket head" })).toBe("Unknown");
  });

  it("picks a stock variant", () => {
    expect(healthVariant({ status: "healthy", capability: "c" })).toBe("default");
    expect(healthVariant({ status: "unhealthy", capability: "c" })).toBe("destructive");
    expect(healthVariant({ status: "unknown", capability: "c" })).toBe("outline");
  });
});
