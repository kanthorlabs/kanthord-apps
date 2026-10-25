import { describe, expect, it } from "vitest";

import {
  analyticsFiltersOf,
  costGroupOf,
  costQueriesOf,
  COST_GROUP_OPTIONS,
  ANALYTICS_BUCKET_OPTIONS,
  ANALYTICS_RANGE_OPTIONS,
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
