import { describe, expect, it } from "vitest";

import { instancePagePath, workerPagePath } from "./worker-paths";

describe("worker paths", () => {
  it("encodes the worker name", () => {
    expect(workerPagePath("coder@1")).toBe("/workers/coder%401");
  });

  it("nests the instance page under the worker page", () => {
    expect(instancePagePath("coder@1", "mac-studio")).toBe(
      "/workers/coder%401/instances/mac-studio",
    );
  });
});
