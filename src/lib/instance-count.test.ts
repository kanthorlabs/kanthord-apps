import { describe, expect, it } from "vitest";

import { effectiveInstanceCount } from "./instance-count";

describe("effectiveInstanceCount", () => {
  it("counts the listed instances of a native binding", () => {
    expect(
      effectiveInstanceCount({ worker: "coder@1", worker_instances: ["mac-studio", "build-01"] }),
    ).toBe(2);
  });

  it("answers 0 for a native binding with an empty list", () => {
    expect(effectiveInstanceCount({ worker: "coder@1", worker_instances: [] })).toBe(0);
  });

  it("reads instance_count for a worker of an external harness", () => {
    expect(effectiveInstanceCount({ worker: "claude-code@1", instance_count: 1 })).toBe(1);
  });
});
