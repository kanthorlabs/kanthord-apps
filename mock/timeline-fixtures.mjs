import { causeAttributes } from "./cause.mjs";
import * as fx from "./fixtures.mjs";

const MINUTE_MS = 60_000;
const MISSION_VERSION = fx.MISSION.version;
const NODE_ID = fx.GRAPH_IDS.changelog;
const PROJECT_ID = fx.PROJECT.id;
const WORKER_NAMES = {
  steps: fx.GRAPH_BINDINGS.worker.resource_identity.split(":").at(-1),
  evaluation: fx.GRAPH_BINDINGS.reviewer.resource_identity.split(":").at(-1),
};

const EXECUTION_SPECS = [
  {
    seed: "d01",
    kind: "steps",
    startAgo: 300,
    endAgo: 290,
    end: "finished",
    rootStored: true,
    transition: { from: "Executing", to: "Waiting", rule: "none" },
  },
  {
    seed: "d02",
    kind: "evaluation",
    startAgo: 280,
    endAgo: 270,
    end: "revoked",
    cause: "assessment",
    rootStored: true,
    transition: { from: "Waiting", to: "Available", rule: "none" },
  },
  {
    seed: "d03",
    kind: "steps",
    startAgo: 260,
    endAgo: 240,
    end: "finished",
    rootStored: false,
    transition: { from: "Executing", to: "Paused", rule: "failure_limit", count: 3, limit: 3 },
  },
  {
    seed: "d09",
    kind: "steps",
    startAgo: 20,
    endAgo: 15,
    end: "revoked",
    cause: "human",
    rootStored: true,
    rootError: true,
    rootCause: { category: "human", assigner: "rule", subcategory: "intervention" },
    childEnded: false,
    transition: { from: "Executing", to: "Paused", rule: "none" },
  },
  {
    seed: "d10",
    kind: "evaluation",
    startAgo: 12,
    endAgo: 8,
    end: "finished",
    rootStored: true,
    rootError: true,
    rootCause: { category: "model", assigner: "reviewer", subcategory: "work_defect" },
    evaluation: { result: "criterion-not-met", stage: "judgement", unmetGrounds: ["stated"] },
    transition: { from: "Waiting", to: "Available", rule: "none" },
  },
];

const ACT_SPECS = [
  { seed: "d04", ago: 200, operation: "mission.node.resume", from: "Paused", to: "Available" },
  {
    seed: "d05",
    ago: 150,
    operation: "mission.node.pause",
    from: "Available",
    to: "Paused",
    reason: "Hold the changelog until the API freeze is over.",
  },
  {
    seed: "d06",
    ago: 100,
    operation: "mission.node.block",
    from: "Paused",
    to: "Blocked",
    reason: "The release notes wait for the legal review.",
  },
  {
    seed: "d07",
    ago: 50,
    operation: "mission.node.unblock",
    from: "Blocked",
    to: "Paused",
    reason: "The legal review is done.",
  },
];

const ENVIRONMENT_SPEC = {
  seed: "d08",
  startAgo: 30,
  endAgo: 25,
  bindingName: "main",
  cause: { category: "environment", assigner: "rule", subcategory: "setup_failed" },
};

const padded = (seed, length) => `${seed}${"0".repeat(length - seed.length)}`;

const summaryOf = (fields) => ({
  trace_id: fields.traceId,
  project_id: PROJECT_ID,
  execution_id: fields.executionId,
  node_id: NODE_ID,
  attempt: fields.attempt,
  root_span_id: fields.rootSpanId,
  created_at: fields.start,
  state: "ok",
  started_at: fields.start,
  ended_at: fields.end,
  duration_ms: fields.end - fields.start,
  stop_reason: null,
  worker_name: fields.workerName,
  agent_names: [],
  models: [],
  input_tokens: 0,
  output_tokens: 0,
  cache_read_tokens: 0,
  cache_creation_tokens: 0,
  total_tokens: 0,
  cost_usd: 0,
  span_count: fields.spanCount,
  turn_count: 0,
  tool_count: 0,
  error_count: 0,
  error_types: [],
  first_error_span_id: null,
  root_operation: fields.root?.operation ?? null,
  root_attributes: fields.root?.attributes ?? null,
});

const spanBuilder = (traceId, rootSpanId) => {
  const spans = [];
  const add = (operation, parentSpanId, start, end, attributes, textIds = []) => {
    const spanId =
      parentSpanId === null
        ? rootSpanId
        : `${rootSpanId.slice(0, 8)}${spans.length.toString(16).padStart(8, "0")}`;
    spans.push({
      trace_id: traceId,
      span_id: spanId,
      parent_span_id: parentSpanId,
      producer: operation.split(".")[0],
      origin: parentSpanId === null ? "asserted" : "observed",
      operation,
      start_time: start,
      end_time: end,
      status: "Ok",
      attributes,
      events: [],
      links: [],
      text_ids: textIds,
      created_at: start,
    });
    return spanId;
  };
  return { spans, add };
};

const executionTrace = (spec, now) => {
  const traceId = padded(spec.seed, 32);
  const rootSpanId = padded(spec.seed, 16);
  const start = now - spec.startAgo * MINUTE_MS;
  const end = now - spec.endAgo * MINUTE_MS;
  const workerName = WORKER_NAMES[spec.kind];
  const { spans, add } = spanBuilder(traceId, rootSpanId);
  const rootAttributes = {
    "kanthord.execution.kind": spec.kind,
    "kanthord.queue.wait_ms": 1200,
    "kanthord.execution.end": spec.end,
    ...(spec.cause === undefined ? {} : { "kanthord.revoke.cause": spec.cause }),
    ...(spec.rootCause === undefined ? {} : causeAttributes(spec.rootCause)),
    "kanthord.worker.name": workerName,
  };
  const root = add("scheduler.execution", null, start, end, rootAttributes);
  const windowMs = end - start;
  if (spec.kind === "steps") {
    const phaseEnd = spec.childEnded === false ? null : end - windowMs * 0.1;
    add("worker.phase", root, start + windowMs * 0.1, phaseEnd, {
      "kanthord.phase": "tasks",
    });
  } else {
    const { evaluation } = spec;
    add(
      "worker.evaluation",
      root,
      start + windowMs * 0.1,
      end - windowMs * 0.1,
      evaluation === undefined
        ? {}
        : {
            "kanthord.evaluation.result": evaluation.result,
            "kanthord.evaluation.stage": evaluation.stage,
            "kanthord.evaluation.unmet_grounds": evaluation.unmetGrounds,
          },
    );
  }
  const { transition } = spec;
  add("scheduler.transition", root, end, end, {
    "kanthord.node.state.from": transition.from,
    "kanthord.node.state.to": transition.to,
    "kanthord.transition.rule": transition.rule,
    ...(transition.rule === "none"
      ? {}
      : {
          "kanthord.transition.count": transition.count,
          "kanthord.transition.limit": transition.limit,
        }),
  });
  if (spec.rootError === true) spans[0].status = "Error";
  const stored = spec.rootStored ? spans : spans.filter((span) => span.span_id !== root);
  const summary = summaryOf({
    traceId,
    rootSpanId,
    executionId: `execution_01J9ZQ4XKM3B6V8N2R5T7W0${spec.seed.toUpperCase()}`,
    attempt: 1,
    start,
    end,
    workerName,
    spanCount: stored.length,
    root: stored.find((span) => span.span_id === rootSpanId),
  });
  return {
    summary: spec.rootError === true ? { ...summary, state: "error", error_count: 1 } : summary,
    spans: stored,
    texts: [],
    entries: [],
  };
};

const actTrace = (spec, now) => {
  const traceId = padded(spec.seed, 32);
  const rootSpanId = padded(spec.seed, 16);
  const at = now - spec.ago * MINUTE_MS;
  const { spans, add } = spanBuilder(traceId, rootSpanId);
  const reasonId = `${rootSpanId}:reason`;
  add(
    spec.operation,
    null,
    at,
    at,
    {
      "kanthord.node.state.from": spec.from,
      "kanthord.node.state.to": spec.to,
      "kanthord.mission.version": MISSION_VERSION,
    },
    spec.reason === undefined ? [] : [reasonId],
  );
  const texts =
    spec.reason === undefined
      ? []
      : [{ trace_id: traceId, text_id: reasonId, content: spec.reason, created_at: at }];
  return {
    summary: summaryOf({
      traceId,
      rootSpanId,
      executionId: null,
      attempt: null,
      start: at,
      end: at,
      workerName: null,
      spanCount: 1,
      root: spans[0],
    }),
    spans,
    texts,
    entries: [],
  };
};

const environmentTrace = (spec, now) => {
  const traceId = padded(spec.seed, 32);
  const rootSpanId = padded(spec.seed, 16);
  const start = now - spec.startAgo * MINUTE_MS;
  const end = now - spec.endAgo * MINUTE_MS;
  const third = (end - start) / 3;
  const { spans, add } = spanBuilder(traceId, rootSpanId);
  const root = add("project.environment", null, start, end, {
    "project.id": PROJECT_ID,
    "project.binding.name": spec.bindingName,
    "environment.target": "server",
    "error.type": "proof_failed",
    ...causeAttributes(spec.cause),
  });
  add("environment.build", root, start, start + third, {});
  add("environment.setup", root, start + third, start + 2 * third, {});
  const proof = add("environment.proof", root, start + 2 * third, end, {
    "error.type": "proof_failed",
  });
  for (const span of spans) {
    if (span.span_id === root || span.span_id === proof) span.status = "Error";
  }
  return {
    summary: {
      ...summaryOf({
        traceId,
        rootSpanId,
        executionId: null,
        attempt: null,
        start,
        end,
        workerName: null,
        spanCount: spans.length,
        root: spans[0],
      }),
      node_id: null,
      state: "error",
      error_count: 2,
      error_types: ["proof_failed"],
      first_error_span_id: proof,
    },
    spans,
    texts: [],
    entries: [],
  };
};

export const buildTimelineTraces = (now) => [
  ...EXECUTION_SPECS.map((spec) => executionTrace(spec, now)),
  ...ACT_SPECS.map((spec) => actTrace(spec, now)),
  environmentTrace(ENVIRONMENT_SPEC, now),
];
