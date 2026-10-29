import { describe, expect, it } from "vitest";

import {
  ANALYTICS_BUCKET_OPTIONS,
  ANALYTICS_RANGE_OPTIONS,
  analyticsFiltersOf,
  COST_GROUP_OPTIONS,
  costGroupOf,
  costQueriesOf,
  TIME_GROUP_OPTIONS,
  TIME_MEASURE_OPTIONS,
  timeGroupOf,
  timeMeasureOf,
  timeQueryOf,
} from "./analytics-query";

const NOW = 10_000_000_000;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe("analyticsFiltersOf", () => {
  it("defaults to all projects, Last 7 days and Day", () => {
    expect(analyticsFiltersOf(new URLSearchParams())).toEqual({
      projectId: null,
      range: "7d",
      bucket: "day",
    });
  });

  it("reads the query string", () => {
    const params = new URLSearchParams("project_id=prj-1&range=30d&bucket=week");

    expect(analyticsFiltersOf(params)).toEqual({
      projectId: "prj-1",
      range: "30d",
      bucket: "week",
    });
  });

  it("falls back to the default for a value that the page does not offer", () => {
    const params = new URLSearchParams("range=all&bucket=none");

    expect(analyticsFiltersOf(params)).toMatchObject({ range: "7d", bucket: "day" });
  });
});

describe("costGroupOf", () => {
  it("defaults to model and ignores an unknown group", () => {
    expect(costGroupOf(new URLSearchParams())).toBe("model");
    expect(costGroupOf(new URLSearchParams("group_by=none"))).toBe("model");
  });

  it("reads a known group", () => {
    expect(costGroupOf(new URLSearchParams("group_by=node_id"))).toBe("node_id");
  });
});

describe("costQueriesOf", () => {
  it("reads the groups by the bucket and the totals with no group and no bucket", () => {
    const filters = { projectId: null, range: "7d", bucket: "day" } as const;

    expect(costQueriesOf(filters, "model", NOW)).toEqual({
      grouped: { from: NOW - 7 * DAY, to: NOW, bucket: "day", group_by: "model" },
      totals: { from: NOW - 7 * DAY, to: NOW, bucket: "none", group_by: "none" },
    });
  });

  it("scopes both reads to a project", () => {
    const filters = { projectId: "prj-1", range: "24h", bucket: "hour" } as const;

    const { grouped, totals } = costQueriesOf(filters, "agent_name", NOW);

    expect(grouped).toEqual({
      from: NOW - DAY,
      to: NOW,
      project_id: "prj-1",
      bucket: "hour",
      group_by: "agent_name",
    });
    expect(totals).toMatchObject({ project_id: "prj-1", from: NOW - DAY });
  });
});

describe("options", () => {
  it("offers the ranges, the buckets and the groups of the page", () => {
    expect(ANALYTICS_RANGE_OPTIONS.map((option) => option.label)).toEqual([
      "Last 24 hours",
      "Last 7 days",
      "Last 30 days",
    ]);
    expect(ANALYTICS_BUCKET_OPTIONS.map((option) => option.label)).toEqual(["Hour", "Day", "Week"]);
    expect(COST_GROUP_OPTIONS.map((option) => [option.value, option.label])).toEqual([
      ["model", "Model"],
      ["agent_name", "Agent"],
      ["provider_name", "Provider"],
      ["worker_name", "Worker"],
      ["node_id", "Node"],
      ["project_id", "Project"],
    ]);
  });
});

describe("time options", () => {
  it("offers the measures and the groups of the Time section", () => {
    expect(TIME_MEASURE_OPTIONS.map((option) => option.label)).toEqual([
      "Span duration",
      "Tool latency",
      "Verification time",
      "Queue wait",
      "Review wait",
      "Revision turns",
      "Test floor share",
    ]);
    expect(TIME_GROUP_OPTIONS.map((option) => option.value)).toEqual([
      "none",
      "operation",
      "tool_name",
      "agent_name",
      "model",
      "worker_name",
      "node_id",
      "project_id",
    ]);
  });
});

describe("timeMeasureOf and timeGroupOf", () => {
  it("default to span_duration and none and ignore an unknown value", () => {
    expect(timeMeasureOf(new URLSearchParams("time_measure=cost"))).toBe("span_duration");
    expect(timeGroupOf(new URLSearchParams("time_group_by=model2"))).toBe("none");
    expect(timeMeasureOf(new URLSearchParams())).toBe("span_duration");
    expect(timeGroupOf(new URLSearchParams())).toBe("none");
  });

  it("read a known value", () => {
    expect(timeMeasureOf(new URLSearchParams("time_measure=queue_wait"))).toBe("queue_wait");
    expect(timeGroupOf(new URLSearchParams("time_group_by=tool_name"))).toBe("tool_name");
  });
});

describe("timeQueryOf", () => {
  it("reads the measure by the group, the bucket and the range", () => {
    const filters = { projectId: null, range: "7d", bucket: "day" } as const;

    expect(timeQueryOf(filters, "tool_latency", "tool_name", NOW)).toEqual({
      from: NOW - 7 * DAY,
      to: NOW,
      bucket: "day",
      measure: "tool_latency",
      group_by: "tool_name",
    });
  });

  it("scopes the read to a project", () => {
    const filters = { projectId: "prj-1", range: "24h", bucket: "hour" } as const;

    expect(timeQueryOf(filters, "span_duration", "none", NOW)).toMatchObject({
      project_id: "prj-1",
      from: NOW - DAY,
    });
  });
});
