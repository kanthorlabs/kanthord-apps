import { describe, expect, it } from "vitest";

import { instancePagePath, workerPagePath, workersPath } from "./worker-paths";

describe("worker paths", () => {
  it("encodes the worker name", () => {
    expect(workerPagePath("coder@1")).toBe("/workers/coder%401");
  });

  it("appends the encoded project to the worker page", () => {
    expect(workerPagePath("coder@1", "prj a")).toBe("/workers/coder%401?project=prj%20a");
  });

  it("appends no project for an empty project", () => {
    expect(workerPagePath("coder@1", "")).toBe("/workers/coder%401");
    expect(instancePagePath("coder@1", "mac-studio", "")).toBe(
      "/workers/coder%401/instances/mac-studio",
    );
  });

  it("appends the encoded project to the instance page", () => {
    expect(instancePagePath("coder@1", "mac-studio", "prj a")).toBe(
      "/workers/coder%401/instances/mac-studio?project=prj%20a",
    );
  });

  it("appends the encoded project to the catalogue path", () => {
    expect(workersPath()).toBe("/workers");
    expect(workersPath("")).toBe("/workers");
    expect(workersPath("prj a")).toBe("/workers?project=prj%20a");
  });

  it("nests the instance page under the worker page", () => {
    expect(instancePagePath("coder@1", "mac-studio")).toBe(
      "/workers/coder%401/instances/mac-studio",
    );
  });
});
