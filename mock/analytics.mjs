const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
const MONDAY_OFFSET_MS = 4 * DAY_MS;
const MAX_RANGE_MS = 31 * DAY_MS;
const DEFAULT_RANGE_MS = 7 * DAY_MS;
const MAX_ITEMS = 1000;
const TURN_COUNT = 60;
const TURN_STEP_MS = 2.5 * HOUR_MS;
const TURNS_PER_NODE = 6;
const BUCKETS = ["none", "hour", "day", "week"];
const DURATION_GROUPS = [
  "none",
  "operation",
  "tool_name",
  "agent_name",
  "model",
  "worker_name",
  "node_id",
  "project_id",
];
const MEASURES = [
  "span_duration",
  "tool_latency",
  "verification_time",
  "queue_wait",
  "review_wait",
  "revision_turns",
  "test_floor_share",
];
const MODELS = [
  ["claude-sonnet-4-5", "anthropic", 0.000003, 0.000015],
  ["gpt-5", "openai", 0.0000025, 0.00001],
  ["gemini-2.5-pro", "google", 0.0000018, 0.000009],
];
const AGENTS = ["general-main", "reviewer-main"];
const PROJECTS = ["prj-kanthord", "prj-atlas"];
const WORKERS = ["server", "worker"];
const TOOLS = ["read_file", "run_command", "edit_file"];
const MEASURE_SPANS = {
  span_duration: () => true,
  tool_latency: (span) => span.operation === "agent.tool",
  verification_time: (span) => span.operation === "worker.verification",
  queue_wait: (span) => span.operation === "scheduler.execution",
  review_wait: (span) => span.operation === "scheduler.execution",
  revision_turns: (span) => span.operation === "scheduler.execution",
  test_floor_share: (span) => span.operation === "worker.verification",
};
const MEASURE_VALUES = {
  span_duration: (span) => span.end - span.start,
  tool_latency: (span) => span.end - span.start,
  verification_time: (span) => span.end - span.start,
  queue_wait: (span) => span.queueWait,
  review_wait: (span) => span.reviewWait,
  revision_turns: (span) => span.revisionTurns,
};

const buildSpans = (now) =>
  Array.from({ length: TURN_COUNT }, (_unused, index) => {
    const model = MODELS[index % MODELS.length];
    const node = Math.floor(index / TURNS_PER_NODE);
    const start = Math.round(now - (index + 1) * TURN_STEP_MS);
    const common = {
      project_id: PROJECTS[node % PROJECTS.length],
      node_id: `node-${node + 1}`,
      worker_name: WORKERS[node % WORKERS.length],
      agent_name: AGENTS[index % AGENTS.length],
      model: model[0],
      provider_name: model[1],
    };
    const input = 1500 + 211 * (index % 7) + 400 * (index % 3);
    const output = 200 + 37 * (index % 5);
    const turnMs = 20_000 + 3000 * (index % 9);
    const toolMs = 400 + 90 * (index % 11);
    const spans = [
      {
        ...common,
        operation: "agent.turn",
        tool_name: null,
        start,
        end: start + turnMs,
        usage: {
          input,
          output,
          cacheRead: 700 * (index % 4),
          cacheCreation: index % 6 === 0 ? 350 : 0,
          cost: Number((input * model[2] + output * model[3]).toFixed(6)),
        },
      },
      {
        ...common,
        operation: "agent.tool",
        tool_name: TOOLS[index % TOOLS.length],
        start: start + 2000,
        end: start + 2000 + toolMs,
      },
    ];
    if (index % 5 === 0) {
      spans.push({
        ...common,
        operation: "worker.verification",
        tool_name: null,
        start: start + turnMs,
        end: start + turnMs + 15_000 + 2500 * (index % 7),
        spanId: `verification-${String(index).padStart(4, "0")}`,
        floorShare: Number((0.15 + 0.1 * (index % 6)).toFixed(2)),
      });
    }
    if (index % TURNS_PER_NODE === 0) {
      spans.push({
        ...common,
        operation: "scheduler.execution",
        tool_name: null,
        start,
        end: start + TURNS_PER_NODE * TURN_STEP_MS,
        queueWait: 5000 + 1500 * (node % 8),
        reviewWait: 60_000 + 20_000 * (node % 5),
        revisionTurns: node % 4,
      });
    }
    return spans;
  }).flat();

const rangeError = (message) => ({
  status: 400,
  code: "tracking.filter.range_invalid",
  message,
});

const invalid = (message) => ({
  status: 400,
  code: "gateway.request.validation_failed",
  message,
});

const integerOf = (value) => (/^-?\d+$/.test(value) ? Number(value) : null);

const closedSet = (params, name, allowed, fallback) => {
  const value = params.get(name) ?? fallback;
  return allowed.includes(value) ? value : null;
};

const rangeOf = (params, now) => {
  const bounds = ["from", "to"].map((name) =>
    params.get(name) === null ? undefined : integerOf(params.get(name)),
  );
  if (bounds.includes(null)) return { error: invalid("The range is in Unix milliseconds.") };
  const to = bounds[1] ?? now;
  const from = bounds[0] ?? to - DEFAULT_RANGE_MS;
  if (from > to) return { error: rangeError("The from is after the to.") };
  if (to - from > MAX_RANGE_MS) return { error: rangeError("The range is more than 31 days.") };
  return { from, to };
};

const bucketStartOf = (bucket, time) => {
  if (bucket === "none") return null;
  if (bucket === "hour") return Math.floor(time / HOUR_MS) * HOUR_MS;
  if (bucket === "day") return Math.floor(time / DAY_MS) * DAY_MS;
  return Math.floor((time - MONDAY_OFFSET_MS) / WEEK_MS) * WEEK_MS + MONDAY_OFFSET_MS;
};

const queryOf = (params, now, groups, fallbackGroup) => {
  const range = rangeOf(params, now);
  if (range.error !== undefined) return range;
  const bucket = closedSet(params, "bucket", BUCKETS, "day");
  if (bucket === null) return { error: invalid("The bucket is unknown.") };
  const groupBy = closedSet(params, "group_by", groups, fallbackGroup);
  if (groupBy === null) return { error: invalid("The group_by is unknown.") };
  return { ...range, bucket, groupBy };
};

const select = (spans, params, query, accepts) =>
  spans.filter(
    (span) =>
      accepts(span) &&
      span.start >= query.from &&
      span.start <= query.to &&
      (params.get("project_id") === null || span.project_id === params.get("project_id")) &&
      (params.get("node_id") === null || span.node_id === params.get("node_id")),
  );

const groupSpans = (spans, query) => {
  const groups = new Map();
  for (const span of spans) {
    const key = query.groupBy === "none" ? null : (span[query.groupBy] ?? null);
    const bucketStart = bucketStartOf(query.bucket, span.start);
    const id = `${bucketStart}|${key}`;
    const group = groups.get(id) ?? { key, bucket_start: bucketStart, spans: [] };
    group.spans.push(span);
    groups.set(id, group);
  }
  return [...groups.values()];
};

const compareKeys = (a, b) => {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a.localeCompare(b);
};

const finish = (rows, query, orderKey) => {
  const ordered = rows.sort(
    (a, b) =>
      (a.bucket_start ?? 0) - (b.bucket_start ?? 0) ||
      b[orderKey] - a[orderKey] ||
      compareKeys(a.key, b.key),
  );
  return {
    items: ordered.slice(0, MAX_ITEMS),
    truncated:
      ordered.length > MAX_ITEMS || (query.groupBy === "node_id" && query.bucket === "hour"),
  };
};

const sumOf = (spans, pick) => spans.reduce((total, span) => total + pick(span), 0);

const percentileOf = (sorted, fraction) =>
  sorted[Math.max(Math.ceil(fraction * sorted.length) - 1, 0)];

const durationRow = (measure) => {
  const valueOf = MEASURE_VALUES[measure];
  return ({ key, bucket_start, spans }) => {
    const values = spans.map(valueOf).sort((a, b) => a - b);
    return {
      key,
      bucket_start,
      count: values.length,
      p50: percentileOf(values, 0.5),
      p90: percentileOf(values, 0.9),
      p99: percentileOf(values, 0.99),
      mean: Number((sumOf(values, (value) => value) / values.length).toFixed(2)),
      max: values.at(-1),
    };
  };
};

const isLater = (span, last) =>
  span.start > last.start || (span.start === last.start && span.spanId > last.spanId);

const floorShareRow = ({ key, bucket_start, spans }) => {
  const latest = spans.reduce((last, span) => (isLater(span, last) ? span : last));
  return { key, bucket_start, count: spans.length, share: latest.floorShare };
};

export function buildAnalytics(now) {
  const spans = buildSpans(now);

  const readDuration = (params, readAt) => {
    const measure = closedSet(params, "measure", MEASURES, null);
    if (measure === null) return { error: invalid("The measure is required and closed.") };
    const query = queryOf(params, readAt, DURATION_GROUPS, "none");
    if (query.error !== undefined) return query;
    const operation = params.get("operation");
    const chosen = select(
      spans,
      params,
      query,
      (span) =>
        MEASURE_SPANS[measure](span) &&
        (measure !== "span_duration" || operation === null || span.operation === operation),
    );
    const rowOf = measure === "test_floor_share" ? floorShareRow : durationRow(measure);
    return finish(groupSpans(chosen, query).map(rowOf), query, "count");
  };

  return { readDuration };
}
