import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/resources/tracking", () => ({
  listTraceSpans: vi.fn(),
  readTrace: vi.fn(),
  readTraceText: vi.fn(),
}));

import { readTraceText } from "@/api/resources/tracking";
import type {
  EffectiveCause,
  SpanAttributeValue,
  SpanStatus,
  TraceSpan,
  TraceState,
  TraceSummary,
} from "@/api/types";

import { useDiagnosis } from "./use-diagnosis";
import type { NodeAttempt, NodeExecution, NodeTraces } from "./use-node-traces";
import { TRACE_POLL_MS } from "./use-trace";

const MINUTE_MS = 60_000;
const NO_TASK_NAMES: ReadonlyMap<string, string> = new Map();

function span(
  spanId: string,
  operation: string,
  overrides: Partial<TraceSpan> & {
    readonly attributes?: Readonly<Record<string, SpanAttributeValue>>;
  } = {},
): TraceSpan {
  return {
    trace_id: "trace-1",
    span_id: spanId,
    parent_span_id: "root",
    producer: "worker",
    origin: "observed",
    operation,
    start_time: 1000,
    end_time: 2000,
    status: "Unset" as SpanStatus,
    attributes: {},
    events: [],
    links: [],
    text_ids: [],
    created_at: 2000,
    ...overrides,
  };
}

function root(attributes: Readonly<Record<string, SpanAttributeValue>>, status: SpanStatus) {
  return span("root", "scheduler.execution", {
    parent_span_id: null,
    start_time: 0,
    end_time: 5000,
    status,
    attributes,
    created_at: 0,
  });
}

function summary(state: TraceState = "error"): TraceSummary {
  return {
    trace_id: "trace-1",
    project_id: "project-1",
    execution_id: null,
    node_id: "node-1",
    attempt: 1,
    root_span_id: "root",
    created_at: 0,
    state,
    started_at: 0,
    ended_at: state === "open" ? null : 5000,
    duration_ms: null,
    stop_reason: null,
    worker_name: null,
    agent_names: [],
    models: [],
    input_tokens: 0,
    output_tokens: 0,
    cache_read_tokens: 0,
    cache_creation_tokens: 0,
    total_tokens: 0,
    cost_usd: 0,
    span_count: 0,
    turn_count: 0,
    tool_count: 0,
    error_count: 0,
    error_types: [],
    first_error_span_id: null,
    root_operation: "scheduler.execution",
    root_attributes: null,
  };
}

function execution(overrides: Partial<NodeExecution>): NodeExecution {
  return {
    traceId: "trace-1",
    kind: "steps",
    cause: null,
    kindLabel: "Steps",
    stateLabel: "Ok",
    causeText: null,
    durationLabel: "1 s",
    isRepeat: false,
    advice: null,
    current: false,
    promptChanged: false,
    path: "/traces/trace-1?tab=summary",
    ...overrides,
  };
}

function nodeTraces(executions: readonly NodeExecution[] = []): NodeTraces {
  const groups: readonly NodeAttempt[] =
    executions.length === 0
      ? []
      : [{ attempt: 1, nodeRevision: 1, planChanged: false, executions }];
  return {
    items: [],
    groups,
    repeatedAttempts: 0,
    repeatedExecutions: 0,
    loading: false,
    error: null,
    retry: vi.fn(),
  };
}

const PROVIDER_CAUSE: Readonly<Record<string, SpanAttributeValue>> = {
  "kanthord.cause.category": "llm_provider",
  "kanthord.cause.subcategory": "rate_limited",
  "kanthord.cause.assigner": "rule",
};

const PROVIDER_STOP: Readonly<Record<string, SpanAttributeValue>> = {
  "kanthord.stop.reason": "provider_failed",
  "kanthord.stop.code": "rate_limited",
  "kanthord.stop.detail": "429 Too Many Requests",
};

function providerSpans(): readonly TraceSpan[] {
  return [
    root({ ...PROVIDER_CAUSE, ...PROVIDER_STOP }, "Error"),
    span("task", "worker.task", {
      status: "Error",
      end_time: 5000,
      attributes: { "kanthord.task.id": "t2" },
    }),
    span("turn-4", "agent.turn", {
      parent_span_id: "task",
      end_time: 3000,
      attributes: { "kanthord.turn.index": 4 },
    }),
    span("turn-5", "agent.turn", {
      parent_span_id: "task",
      start_time: 3000,
      end_time: 4000,
      status: "Error",
      attributes: {
        "kanthord.turn.index": 5,
        "error.type": "rate_limited",
        "gen_ai.provider.name": "anthropic",
        "gen_ai.response.model": "claude-sonnet",
      },
    }),
  ];
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("useDiagnosis", () => {
  it("answers an llm_provider cause with its sentence and evidence", () => {
    const { result } = renderHook(() =>
      useDiagnosis(summary(), providerSpans(), nodeTraces(), 6000, NO_TASK_NAMES),
    );

    expect(result.current.cause?.category).toBe("llm_provider");
    expect(result.current.causalSpan?.span_id).toBe("turn-5");
    expect(result.current.sentence).toBe(
      "Turn 5 of Task t2 failed: rate_limited. The execution stopped: provider_failed / rate_limited.",
    );
    expect(result.current.stop).toMatchObject({
      reason: "provider_failed",
      code: "rate_limited",
      detail: "429 Too Many Requests",
    });
    expect(result.current.evidence).toEqual([
      { text: "Turn 5 error.type rate_limited", spanId: "turn-5" },
      { text: "Stop detail: 429 Too Many Requests", spanId: "root" },
      { text: "Provider anthropic, Model claude-sonnet", spanId: "turn-5" },
    ]);
    expect(result.current.errorSteps).toEqual(["turn-5", "task", "root"]);
    expect(result.current.rework).toBeNull();
    expect(result.current.now).toBeNull();
  });

  it("names the node in the sentence for a task of a node with no task files", () => {
    const { result } = renderHook(() =>
      useDiagnosis(
        summary(),
        providerSpans(),
        nodeTraces(),
        6000,
        new Map([["t2", "Ship the page"]]),
      ),
    );

    expect(result.current.sentence).toBe(
      "Turn 5 of Ship the page failed: rate_limited. The execution stopped: provider_failed / rate_limited.",
    );
  });

  it("states the revocation of a revoked execution", () => {
    const spans = [
      root(
        {
          "kanthord.cause.category": "human",
          "kanthord.cause.subcategory": "intervention",
          "kanthord.cause.assigner": "rule",
          "kanthord.execution.end": "revoked",
          "kanthord.revoke.cause": "human",
        },
        "Unset",
      ),
    ];
    const { result } = renderHook(() =>
      useDiagnosis(summary(), spans, nodeTraces(), 6000, NO_TASK_NAMES),
    );

    expect(result.current.sentence).toBe("Revoked by a human.");
    expect(result.current.evidence).toEqual([{ text: "Revoked by a human", spanId: "root" }]);
  });

  it("takes the evidence of each suspect of an unattributed cause in suspect order", () => {
    const spans = [
      root(
        {
          "kanthord.cause.category": "unattributed",
          "kanthord.cause.assigner": "rule",
          "kanthord.cause.suspects": ["plan", "model"],
          "kanthord.stop.reason": "budget_end",
          "kanthord.stop.code": "turns",
        },
        "Error",
      ),
      span("task", "worker.task", { attributes: { "kanthord.task.id": "t2" } }),
      span("turn-1", "agent.turn", { parent_span_id: "task" }),
      span("turn-2", "agent.turn", {
        parent_span_id: "task",
        attributes: { "kanthord.prompt.template": "task-revision" },
      }),
      span("turn-3", "agent.turn", {
        parent_span_id: "task",
        attributes: { "kanthord.prompt.template": "task-revision" },
      }),
    ];
    const { result } = renderHook(() =>
      useDiagnosis(summary(), spans, nodeTraces(), 6000, NO_TASK_NAMES),
    );

    expect(result.current.cause?.suspects).toEqual(["plan", "model"]);
    expect(result.current.evidence).toEqual([
      { text: "Task t2: 3 turns", spanId: "task" },
      { text: "2 task-revision turns", spanId: "turn-2" },
    ]);
  });

  it("limits the evidence to 4 lines", () => {
    const spans = [
      root(
        {
          "kanthord.cause.category": "unattributed",
          "kanthord.cause.assigner": "rule",
          "kanthord.cause.suspects": ["plan"],
        },
        "Error",
      ),
      ...["a", "b", "c", "d", "e"].flatMap((id) => [
        span(`task-${id}`, "worker.task", { attributes: { "kanthord.task.id": id } }),
        span(`turn-${id}`, "agent.turn", { parent_span_id: `task-${id}` }),
      ]),
    ];
    const { result } = renderHook(() =>
      useDiagnosis(summary(), spans, nodeTraces(), 6000, NO_TASK_NAMES),
    );

    expect(result.current.evidence).toHaveLength(4);
  });

  it("reads the reason of a labeled cause", async () => {
    vi.mocked(readTraceText).mockResolvedValue({
      trace_id: "trace-1",
      text_id: "root.cause_label:reason",
      content: "The work prompt lacked the node context",
      created_at: 3000,
    });
    const spans = [
      root({ ...PROVIDER_CAUSE, ...PROVIDER_STOP }, "Error"),
      span("root.cause_label", "tracking.cause_label", {
        attributes: {
          "kanthord.cause.category": "prompt",
          "kanthord.cause.subcategory": "context_missing",
          "kanthord.human.username": "ulrich",
        },
        created_at: 3000,
      }),
    ];
    const { result } = renderHook(() =>
      useDiagnosis(summary(), spans, nodeTraces(), 6000, NO_TASK_NAMES),
    );

    await waitFor(() =>
      expect(result.current.reason).toBe("The work prompt lacked the node context"),
    );
    expect(result.current.cause).toMatchObject({ category: "prompt", assigner: "human" });
    expect(result.current.labeledBy).toBe("ulrich");
    expect(readTraceText).toHaveBeenCalledWith("trace-1", "root.cause_label:reason");
  });

  it("reads no reason for a cause that no human labeled", () => {
    renderHook(() => useDiagnosis(summary(), providerSpans(), nodeTraces(), 6000, NO_TASK_NAMES));

    expect(readTraceText).not.toHaveBeenCalled();
  });

  it("answers the rework cause of a steps trace with no cause and a next evaluation cause", () => {
    const reworkCause: EffectiveCause = {
      category: "model",
      subcategory: "work_defect",
      assigner: "reviewer",
    };
    const spans = [root({}, "Ok")];
    const executions = nodeTraces([
      execution({ traceId: "trace-1", current: true }),
      execution({
        traceId: "trace-2",
        kind: "evaluation",
        cause: reworkCause,
        path: "/traces/trace-2?tab=summary",
      }),
    ]);
    const { result } = renderHook(() =>
      useDiagnosis(summary("ok"), spans, executions, 6000, NO_TASK_NAMES),
    );

    expect(result.current.cause).toBeNull();
    expect(result.current.rework).toEqual({
      cause: reworkCause,
      traceId: "trace-2",
      path: "/traces/trace-2?tab=summary",
    });
  });

  it("answers no rework cause when the next evaluation holds no cause", () => {
    const executions = nodeTraces([
      execution({ traceId: "trace-1", current: true }),
      execution({ traceId: "trace-2", kind: "evaluation" }),
    ]);
    const { result } = renderHook(() =>
      useDiagnosis(summary("ok"), [root({}, "Ok")], executions, 6000, NO_TASK_NAMES),
    );

    expect(result.current.rework).toBeNull();
  });

  it("answers no rework cause for a steps trace with no next evaluation", () => {
    const executions = nodeTraces([execution({ traceId: "trace-1", current: true })]);
    const { result } = renderHook(() =>
      useDiagnosis(summary("ok"), [root({}, "Ok")], executions, 6000, NO_TASK_NAMES),
    );

    expect(result.current.cause).toBeNull();
    expect(result.current.rework).toBeNull();
  });

  it("counts the recovered errors of a trace with no cause", () => {
    const spans = [
      root({}, "Ok"),
      span("tool", "agent.tool", { status: "Error", end_time: 3000 }),
      span("turn", "agent.turn", { start_time: 3000, end_time: 4000 }),
    ];
    const { result } = renderHook(() =>
      useDiagnosis(summary("ok"), spans, nodeTraces(), 6000, NO_TASK_NAMES),
    );

    expect(result.current.cause).toBeNull();
    expect(result.current.causalSpan).toBeNull();
    expect(result.current.sentence).toBeNull();
    expect(result.current.errorSteps).toEqual([]);
    expect(result.current.recoveredCount).toBe(1);
  });

  it("keeps the pick while the span list keeps its identity", () => {
    const spans = providerSpans();
    const { result, rerender } = renderHook(
      ({ now }) => useDiagnosis(summary(), spans, nodeTraces(), now, NO_TASK_NAMES),
      { initialProps: { now: 6000 } },
    );
    const first = result.current.evidence;
    rerender({ now: 7000 });

    expect(result.current.evidence).toBe(first);
  });

  it("answers the Now facts of an open trace with a gap in the records", () => {
    const spans = [
      span("root", "scheduler.execution", {
        parent_span_id: null,
        start_time: 0,
        end_time: null,
        created_at: 0,
      }),
      span("task", "worker.task", { end_time: null, created_at: 1000 }),
      span("turn-2", "agent.turn", {
        parent_span_id: "task",
        start_time: 2000,
        end_time: null,
        created_at: 2000,
        attributes: { "kanthord.turn.index": 2 },
      }),
    ];
    const now = 2000 + 8 * MINUTE_MS;
    const { result } = renderHook(() =>
      useDiagnosis(summary("open"), spans, nodeTraces(), now, NO_TASK_NAMES),
    );

    expect(result.current.now).toEqual({
      running: spans[2],
      runningLabel: "Turn 2",
      age: "8 min",
      sinceLatestRecord: "8 min",
      gapWarning: "No new record for 8 min",
    });
  });

  it("answers no gap warning within 6 poll intervals", () => {
    const spans = [
      span("root", "scheduler.execution", {
        parent_span_id: null,
        end_time: null,
        created_at: 1000,
      }),
    ];
    const now = 1000 + 6 * TRACE_POLL_MS;
    const { result } = renderHook(() =>
      useDiagnosis(summary("open"), spans, nodeTraces(), now, NO_TASK_NAMES),
    );

    expect(result.current.now?.gapWarning).toBeNull();
  });
});
