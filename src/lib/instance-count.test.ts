import { describe, expect, it } from "vitest";

import { effectiveInstanceCount } from "./instance-count";

describe("effectiveInstanceCount", () => {
  it("counts the listed instances at the worker placement", () => {
    expect(
      effectiveInstanceCount({
        worker: "coder@1",
        placement: "worker",
        worker_instances: ["mac-studio", "build-01"],
      }),
    ).toBe(2);
  });

  it("reads instance_count at the server and container placements", () => {
    expect(
      effectiveInstanceCount({ worker: "coder@1", placement: "server", instance_count: 3 }),
    ).toBe(3);
    expect(
      effectiveInstanceCount({ worker: "coder@1", placement: "container", instance_count: 1 }),
    ).toBe(1);
  });

  it("reads instance_count for a worker of an external harness", () => {
    expect(effectiveInstanceCount({ worker: "claude-code@1", instance_count: 1 })).toBe(1);
  });

  it("answers 0 for a worker binding with no list", () => {
    expect(effectiveInstanceCount({ worker: "coder@1", placement: "worker" })).toBe(0);
  });
});
