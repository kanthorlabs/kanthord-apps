import { describe, expect, it } from "vitest";

import { flowFiltersOf, flowQueryOf } from "./flow-query";

const NOW = Date.UTC(2026, 9, 30, 14, 12);

function filtersOf(search: string) {
  return flowFiltersOf(new URLSearchParams(search));
}

describe("flowFiltersOf", () => {
  it("opens the flow tab by default", () => {
    expect(filtersOf("").tab).toBe("flow");
  });

  it("reads the flow and cost tabs", () => {
    expect(filtersOf("tab=flow").tab).toBe("flow");
    expect(filtersOf("tab=cost").tab).toBe("cost");
  });

  it("falls back to the flow tab for an unknown tab", () => {
    expect(filtersOf("tab=time").tab).toBe("flow");
    expect(filtersOf("tab=").tab).toBe("flow");
  });

  it("reads the project, the worker, the cause and the stage", () => {
    expect(
      filtersOf("project_id=billing&worker_name=coder@1&cause=model&stage=verification"),
    ).toMatchObject({
      projectId: "billing",
      workerName: "coder@1",
      cause: "model",
      stage: "verification",
    });
  });

  it("defaults the project, the worker, the cause and the stage to none", () => {
    expect(filtersOf("")).toMatchObject({
      projectId: null,
      workerName: null,
      cause: null,
      stage: null,
    });
  });

  it("refuses the queued stage and an unknown stage", () => {
    expect(filtersOf("stage=queued").stage).toBeNull();
    expect(filtersOf("stage=unknown").stage).toBeNull();
  });

  it("reads the range and falls back to 7d", () => {
    expect(filtersOf("range=24h").range).toBe("24h");
    expect(filtersOf("range=30d").range).toBe("30d");
    expect(filtersOf("range=1h").range).toBe("7d");
    expect(filtersOf("").range).toBe("7d");
  });

  it("reads the split and falls back to model", () => {
    expect(filtersOf("split=stage").split).toBe("stage");
    expect(filtersOf("split=worker_name").split).toBe("worker_name");
    expect(filtersOf("split=agent_name").split).toBe("model");
    expect(filtersOf("").split).toBe("model");
  });
});

describe("flowQueryOf", () => {
  it("reads hour buckets from the start of the hour 23 hours back for 24h", () => {
    expect(flowQueryOf(filtersOf("range=24h"), NOW)).toEqual({
      from: Date.UTC(2026, 9, 29, 15),
      to: NOW,
      bucket: "hour",
      compare: "previous",
    });
  });

  it("reads day buckets from the start of the day 6 days back for 7d", () => {
    expect(flowQueryOf(filtersOf("range=7d"), NOW)).toEqual({
      from: Date.UTC(2026, 9, 24),
      to: NOW,
      bucket: "day",
      compare: "previous",
    });
  });

  it("reads day buckets from the start of the day 29 days back for 30d", () => {
    expect(flowQueryOf(filtersOf("range=30d"), NOW)).toEqual({
      from: Date.UTC(2026, 9, 1),
      to: NOW,
      bucket: "day",
      compare: "previous",
    });
  });

  it("sends the project and the worker only when set", () => {
    expect(flowQueryOf(filtersOf("project_id=billing"), NOW)).toMatchObject({
      project_id: "billing",
    });
    expect(flowQueryOf(filtersOf("project_id=billing"), NOW)).not.toHaveProperty("worker_name");
    expect(flowQueryOf(filtersOf("worker_name=coder@1"), NOW)).toMatchObject({
      worker_name: "coder@1",
    });
    expect(flowQueryOf(filtersOf(""), NOW)).not.toHaveProperty("project_id");
  });

  it("always compares with the previous window", () => {
    for (const range of ["24h", "7d", "30d"]) {
      expect(flowQueryOf(filtersOf(`range=${range}`), NOW).compare).toBe("previous");
    }
  });
});
