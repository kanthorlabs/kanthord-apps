import { describe, expect, it } from "vitest";

import {
  DEFAULT_TIME_RANGE,
  TIME_RANGE_LABELS,
  TRACE_QUERY_KEYS,
  traceQueryOf,
  withParam,
} from "./trace-query";

const NOW = 10_000_000_000;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe("trace query constants", () => {
  it("defaults to 7 days", () => {
    expect(DEFAULT_TIME_RANGE).toBe("7d");
  });

  it("labels each range", () => {
    expect(TIME_RANGE_LABELS).toEqual({
      "1h": "Last hour",
      "24h": "Last 24 hours",
      "7d": "Last 7 days",
      "30d": "Last 30 days",
      all: "All time",
    });
  });

  it("lists the query keys", () => {
    expect(TRACE_QUERY_KEYS).toEqual([
      "project_id",
      "node_id",
      "state",
      "range",
      "q",
      "worker_name",
      "agent_name",
      "model",
      "error_type",
      "cause_category",
      "min_duration_ms",
      "min_total_tokens",
      "min_cost_usd",
      "sort",
    ]);
  });
});

describe("traceQueryOf", () => {
  it("copies each text key", () => {
    const params = new URLSearchParams(
      "project_id=p1&q=boom&worker_name=w&agent_name=a&model=m&error_type=timeout&range=all",
    );
    expect(traceQueryOf(params, NOW)).toEqual({
      project_id: "p1",
      q: "boom",
      worker_name: "w",
      agent_name: "a",
      model: "m",
      error_type: "timeout",
    });
  });

  it("uses the default range when range is absent", () => {
    expect(traceQueryOf(new URLSearchParams(), NOW)).toEqual({ from: NOW - 7 * DAY });
  });

  it.each([
    ["1h", HOUR],
    ["24h", DAY],
    ["7d", 7 * DAY],
    ["30d", 30 * DAY],
  ])("maps range %s to from", (range, ms) => {
    expect(traceQueryOf(new URLSearchParams({ range }), NOW).from).toBe(NOW - ms);
  });

  it("sets no from for all", () => {
    expect(traceQueryOf(new URLSearchParams({ range: "all" }), NOW)).toEqual({});
  });

  it("sets no to and no started_from", () => {
    const query = traceQueryOf(new URLSearchParams({ range: "1h" }), NOW);
    expect(query).toEqual({ from: NOW - HOUR });
  });

  it("falls back to the default range for an unknown range", () => {
    expect(traceQueryOf(new URLSearchParams({ range: "1y" }), NOW).from).toBe(NOW - 7 * DAY);
  });

  it("drops an empty key", () => {
    const query = traceQueryOf(new URLSearchParams("q=&model=&range=all"), NOW);
    expect(query).toEqual({});
  });

  it("parses the three minimums as numbers", () => {
    const params = new URLSearchParams(
      "min_duration_ms=1500&min_total_tokens=0&min_cost_usd=0.25&range=all",
    );
    expect(traceQueryOf(params, NOW)).toEqual({
      min_duration_ms: 1500,
      min_total_tokens: 0,
      min_cost_usd: 0.25,
    });
  });

  it.each(["abc", "-1", "Infinity", "NaN", " "])("drops the minimum %j", (value) => {
    const params = new URLSearchParams({ min_duration_ms: value, range: "all" });
    expect(traceQueryOf(params, NOW)).toEqual({});
  });

  it("keeps a valid state and drops an invalid one", () => {
    expect(traceQueryOf(new URLSearchParams("state=error&range=all"), NOW).state).toBe("error");
    expect(traceQueryOf(new URLSearchParams("state=open&range=all"), NOW).state).toBe("open");
    expect(traceQueryOf(new URLSearchParams("state=ok&range=all"), NOW).state).toBe("ok");
    expect(traceQueryOf(new URLSearchParams("state=done&range=all"), NOW)).toEqual({});
  });

  it("maps node_id and a known cause category", () => {
    const params = new URLSearchParams("node_id=node_1&cause_category=llm_provider&range=all");
    expect(traceQueryOf(params, NOW)).toEqual({
      node_id: "node_1",
      cause_category: "llm_provider",
    });
  });

  it("maps an unknown cause category to nothing", () => {
    expect(traceQueryOf(new URLSearchParams("cause_category=gremlins&range=all"), NOW)).toEqual({});
  });

  it("keeps a valid sort and drops an invalid one", () => {
    for (const sort of ["started_at", "duration_ms", "total_tokens", "cost_usd"]) {
      expect(traceQueryOf(new URLSearchParams(`sort=${sort}&range=all`), NOW).sort).toBe(sort);
    }
    expect(traceQueryOf(new URLSearchParams("sort=name&range=all"), NOW)).toEqual({});
  });
});

describe("withParam", () => {
  it("answers a copy with the key set", () => {
    const params = new URLSearchParams("a=1");
    const next = withParam(params, "b", "2");
    expect(next.toString()).toBe("a=1&b=2");
    expect(params.toString()).toBe("a=1");
  });

  it("replaces an existing value", () => {
    expect(withParam(new URLSearchParams("a=1"), "a", "9").toString()).toBe("a=9");
  });

  it("removes the key for null and for an empty string", () => {
    expect(withParam(new URLSearchParams("a=1&b=2"), "a", null).toString()).toBe("b=2");
    expect(withParam(new URLSearchParams("a=1&b=2"), "b", "").toString()).toBe("a=1");
  });
});
