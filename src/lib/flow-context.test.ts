import { describe, expect, it } from "vitest";

import type { FlowRead, Project } from "@/api/types";

import flowRead from "../../test/flow-read.json";
import { contextLineOf } from "./flow-context";

const FLOW_READ = flowRead as unknown as FlowRead;

const ALL = { projectId: null, workerName: null };
const HOUR = 3_600_000;
const HOUR_FROM = Date.UTC(2026, 9, 29, 15);

const PROJECT: Project = {
  id: "prj-1",
  name: "Billing",
  binding_set_version: 1,
  created_at: 0,
  paused_at: null,
  workspace_directory: "/work",
};

const HOUR_READ: FlowRead = {
  ...FLOW_READ,
  window: {
    from: HOUR_FROM,
    to: HOUR_FROM + 24 * HOUR,
    now: FLOW_READ.window.now,
    bucket: "hour",
    buckets: Array.from({ length: 24 }, (_, index) => HOUR_FROM + index * HOUR),
  },
  previous_window: { from: HOUR_FROM - 24 * HOUR, to: HOUR_FROM },
};

describe("contextLineOf", () => {
  it("writes the line of the fixture", () => {
    expect(contextLineOf(FLOW_READ, ALL, [])).toBe(
      "All projects · all workers · Oct 24 00:00 – Oct 30 14:12 UTC (today partial) · vs Oct 17 – Oct 23 to the same hour · counted by claim time",
    );
  });

  it("writes the line of an hour grain read", () => {
    expect(contextLineOf(HOUR_READ, ALL, [])).toBe(
      "All projects · all workers · Oct 29 15:00 – Oct 30 14:12 UTC (this hour partial) · vs Oct 28 15:00 – Oct 29 14:00 to the same hour · counted by claim time",
    );
  });

  it("writes no partial mark and ends at the end of the window with no partial bucket", () => {
    const read = { ...FLOW_READ, window: { ...FLOW_READ.window, now: FLOW_READ.window.to } };

    expect(contextLineOf(read, ALL, [])).toBe(
      "All projects · all workers · Oct 24 00:00 – Oct 31 00:00 UTC · vs Oct 17 – Oct 23 to the same hour · counted by claim time",
    );
  });

  it("writes no same hour mark when a same hour sum is null", () => {
    const read = { ...FLOW_READ, cost: { ...FLOW_READ.cost, previous_same_hour: null } };

    expect(contextLineOf(read, ALL, [])).toBe(
      "All projects · all workers · Oct 24 00:00 – Oct 30 14:12 UTC (today partial) · vs Oct 17 – Oct 23 · counted by claim time",
    );
  });

  it("writes no comparison with a null previous window", () => {
    const read = { ...FLOW_READ, previous_window: null };

    expect(contextLineOf(read, ALL, [])).toBe(
      "All projects · all workers · Oct 24 00:00 – Oct 30 14:12 UTC (today partial) · no comparison: no aggregates · counted by claim time",
    );
  });

  it("writes the project name and the worker name", () => {
    expect(
      contextLineOf(FLOW_READ, { projectId: "prj-1", workerName: "coder@1" }, [PROJECT]),
    ).toMatch(/^Billing · coder@1 · Oct 24/);
  });

  it("writes the identity of a project that is not in the list", () => {
    expect(contextLineOf(FLOW_READ, { projectId: "prj-9", workerName: null }, [PROJECT])).toMatch(
      /^prj-9 · all workers · /,
    );
  });
});
