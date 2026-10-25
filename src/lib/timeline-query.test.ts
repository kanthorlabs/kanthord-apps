import { describe, expect, it } from "vitest";

import { timelineQueryOf, timelineRangeOf, timelineScopeOf } from "./timeline-query";

const NOW = 10_000_000_000;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe("timelineRangeOf", () => {
  it("defaults to Last 24 hours for the project scope", () => {
    expect(timelineRangeOf(new URLSearchParams("project_id=p"))).toBe("24h");
    expect(timelineRangeOf(new URLSearchParams())).toBe("24h");
  });

  it("defaults to All time for the node scope", () => {
    expect(timelineRangeOf(new URLSearchParams("node_id=n"))).toBe("all");
  });

  it("reads a known range and ignores an unknown one", () => {
    expect(timelineRangeOf(new URLSearchParams("node_id=n&range=7d"))).toBe("7d");
    expect(timelineRangeOf(new URLSearchParams("node_id=n&range=2d"))).toBe("all");
  });
});

describe("timelineQueryOf", () => {
  it("scopes to a node and sends no from for All time", () => {
    expect(timelineQueryOf({ kind: "node", nodeId: "n" }, "all", NOW)).toEqual({ node_id: "n" });
  });

  it("scopes to a project and sends the start of the range", () => {
    expect(timelineQueryOf({ kind: "project", projectId: "p" }, "24h", NOW)).toEqual({
      project_id: "p",
      from: NOW - DAY,
    });
    expect(timelineQueryOf({ kind: "project", projectId: "p" }, "1h", NOW)).toEqual({
      project_id: "p",
      from: NOW - HOUR,
    });
  });
});

describe("timelineScopeOf", () => {
  it("prefers the node over the project", () => {
    expect(timelineScopeOf(new URLSearchParams("node_id=n&project_id=p"), "first")).toEqual({
      kind: "node",
      nodeId: "n",
    });
  });

  it("reads the project of the query string", () => {
    expect(timelineScopeOf(new URLSearchParams("project_id=p"), "first")).toEqual({
      kind: "project",
      projectId: "p",
    });
  });

  it("falls back to the first project", () => {
    expect(timelineScopeOf(new URLSearchParams(), "first")).toEqual({
      kind: "project",
      projectId: "first",
    });
    expect(timelineScopeOf(new URLSearchParams("project_id="), "first")).toEqual({
      kind: "project",
      projectId: "first",
    });
  });

  it("has no scope without a project", () => {
    expect(timelineScopeOf(new URLSearchParams(), null)).toBeNull();
  });
});
