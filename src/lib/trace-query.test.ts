import { describe, expect, it } from "vitest";

import {
  DEFAULT_TIME_RANGE,
  TIME_RANGE_LABELS,
  timeWindowOf,
  TRACE_QUERY_KEYS,
  traceQueryOf,
  windowLabelOf,
  withParam,
  withRange,
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
      "from",
      "to",
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

describe("timeWindowOf", () => {
  const OCT_27 = 1_793_059_200_000;
  const OCT_28 = 1_793_145_600_000;

  it("reads both sides", () => {
    const params = new URLSearchParams({ from: String(OCT_27), to: String(OCT_28) });
    expect(timeWindowOf(params)).toEqual({ from: OCT_27, to: OCT_28 });
  });

  it("answers null for an absent side", () => {
    expect(timeWindowOf(new URLSearchParams({ from: "5" }))).toEqual({ from: 5, to: null });
    expect(timeWindowOf(new URLSearchParams({ to: "5" }))).toEqual({ from: null, to: 5 });
  });

  it("answers null when both sides are absent", () => {
    expect(timeWindowOf(new URLSearchParams("range=1h"))).toBeNull();
  });

  it("accepts equal sides", () => {
    expect(timeWindowOf(new URLSearchParams("from=5&to=5"))).toEqual({ from: 5, to: 5 });
  });

  it("answers null when from is after to", () => {
    expect(timeWindowOf(new URLSearchParams("from=6&to=5"))).toBeNull();
  });

  it.each(["abc", "-1", "1.5", "1e3", " 5", "", "9007199254740993", "+5"])(
    "ignores the invalid side %j",
    (value) => {
      expect(timeWindowOf(new URLSearchParams({ from: value }))).toBeNull();
      expect(timeWindowOf(new URLSearchParams({ from: value, to: "5" }))).toEqual({
        from: null,
        to: 5,
      });
    },
  );
});

describe("windowLabelOf", () => {
  it("labels both sides", () => {
    expect(windowLabelOf({ from: 1_793_059_200_000, to: 1_793_145_600_000 })).toBe(
      "Oct 27 00:00 – Oct 28 00:00 UTC",
    );
  });

  it("labels from alone", () => {
    expect(windowLabelOf({ from: 1_793_059_200_000, to: null })).toBe("From Oct 27 00:00 UTC");
  });

  it("labels to alone", () => {
    expect(windowLabelOf({ from: null, to: Date.UTC(2026, 9, 28, 9, 5) })).toBe(
      "Until Oct 28 09:05 UTC",
    );
  });

  it("names the UTC month in three letters", () => {
    expect(windowLabelOf({ from: Date.UTC(2026, 0, 3, 23, 59), to: null })).toBe(
      "From Jan 3 23:59 UTC",
    );
  });
});

describe("traceQueryOf with a window", () => {
  it("takes from and to and ignores range", () => {
    const params = new URLSearchParams("from=100&to=200&range=1h");
    expect(traceQueryOf(params, NOW)).toEqual({ from: 100, to: 200 });
  });

  it("takes one side and ignores range", () => {
    expect(traceQueryOf(new URLSearchParams("to=200&range=1h"), NOW)).toEqual({ to: 200 });
  });

  it("follows range when the window is invalid", () => {
    expect(traceQueryOf(new URLSearchParams("from=9&to=3&range=1h"), NOW)).toEqual({
      from: NOW - HOUR,
    });
    expect(traceQueryOf(new URLSearchParams("from=abc"), NOW)).toEqual({ from: NOW - 7 * DAY });
  });
});

describe("withRange", () => {
  it("writes range and removes from and to", () => {
    const next = withRange(new URLSearchParams("from=1&to=2&state=ok"), "7d");
    expect(next.toString()).toBe("state=ok&range=7d");
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
