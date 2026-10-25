import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/resources/tracking", () => ({
  listTraceSpans: vi.fn(),
  readTrace: vi.fn(),
  readTraceText: vi.fn(),
  labelTraceCause: vi.fn(),
}));

import { ApiError } from "@/api/errors";
import { readTraceText } from "@/api/resources/tracking";
import type { SpanAttributeValue, SpanStatus, TraceSpan, TraceSummary } from "@/api/types";

import type { NodeExecution, NodeTraces } from "../use-node-traces";
import { DiagnosisBlock } from "./diagnosis-block";

function span(
  spanId: string,
  operation: string,
  overrides: Partial<TraceSpan> = {},
  attributes: Readonly<Record<string, SpanAttributeValue>> = {},
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
    attributes,
    events: [],
    links: [],
    text_ids: [],
    created_at: 2000,
    ...overrides,
  };
}

const SUMMARY = {
  trace_id: "trace-1",
  root_span_id: "root",
  state: "error",
  created_at: 0,
} as TraceSummary;

const PROVIDER_ROOT = span(
  "root",
  "scheduler.execution",
  { parent_span_id: null, status: "Error", end_time: 5000 },
  {
    "kanthord.cause.category": "llm_provider",
    "kanthord.cause.subcategory": "rate_limited",
    "kanthord.cause.assigner": "rule",
    "kanthord.stop.reason": "provider_failed",
    "kanthord.stop.code": "rate_limited",
    "kanthord.stop.detail": "429 Too Many Requests",
  },
);

const PROVIDER_SPANS = [
  PROVIDER_ROOT,
  span(
    "turn-5",
    "agent.turn",
    { status: "Error", end_time: 4000 },
    { "kanthord.turn.index": 5, "error.type": "rate_limited" },
  ),
];

function nodeTraces(executions: readonly NodeExecution[] = []): NodeTraces {
  return {
    items: [],
    groups:
      executions.length === 0
        ? []
        : [{ attempt: 1, nodeRevision: 1, planChanged: false, executions }],
    repeatedAttempts: 0,
    repeatedExecutions: 0,
    loading: false,
    error: null,
    retry: vi.fn(),
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

function renderBlock(spans: readonly TraceSpan[], node: NodeTraces = nodeTraces()) {
  const onSelectSpan = vi.fn();
  const onLabeled = vi.fn();
  render(
    <MemoryRouter>
      <DiagnosisBlock
        summary={SUMMARY}
        spans={spans}
        nodeTraces={node}
        now={6000}
        selectedSpanId={null}
        onSelectSpan={onSelectSpan}
        onLabeled={onLabeled}
      />
    </MemoryRouter>,
  );
  return { onSelectSpan, onLabeled };
}

beforeEach(() => {
  vi.mocked(readTraceText).mockReset();
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
});

describe("DiagnosisBlock", () => {
  it("states the cause, the sentence and the evidence", () => {
    renderBlock(PROVIDER_SPANS);

    expect(screen.getByRole("heading", { name: "What went wrong" })).toBeInTheDocument();
    expect(screen.getByText("LLM provider - rate limited")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Turn 5 failed: rate_limited. The execution stopped: provider_failed / rate_limited.",
      ),
    ).toBeInTheDocument();
    const evidence = screen.getByRole("list", { name: "Evidence lines" });
    expect(within(evidence).getAllByRole("listitem")).toHaveLength(2);
  });

  it("selects the span of an evidence line", async () => {
    const { onSelectSpan } = renderBlock(PROVIDER_SPANS);

    await userEvent.click(
      screen.getByRole("button", { name: "Stop detail: 429 Too Many Requests" }),
    );

    expect(onSelectSpan).toHaveBeenCalledWith("root");
  });

  it("opens the causal span", async () => {
    const { onSelectSpan } = renderBlock(PROVIDER_SPANS);

    await userEvent.click(screen.getByRole("button", { name: "Open causal span" }));

    expect(onSelectSpan).toHaveBeenCalledWith("turn-5");
  });

  it("steps through the errors from the causal span", async () => {
    const { onSelectSpan } = renderBlock(PROVIDER_SPANS);

    expect(screen.getByText("1/2 errors")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous error" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Next error" }));

    expect(onSelectSpan).toHaveBeenCalledWith("root");
  });

  it("opens the Label cause sheet", async () => {
    renderBlock(PROVIDER_SPANS);

    await userEvent.click(screen.getByRole("button", { name: "Label cause" }));

    expect(await screen.findByRole("form", { name: "Label cause" })).toBeInTheDocument();
  });

  it("shows who labeled the cause and the reason", async () => {
    vi.mocked(readTraceText).mockResolvedValue({
      trace_id: "trace-1",
      text_id: "root.cause_label:reason",
      content: "The prompt lacked the context.",
      created_at: 3000,
    });
    renderBlock([
      ...PROVIDER_SPANS,
      span(
        "root.cause_label",
        "tracking.cause_label",
        { created_at: 3000 },
        {
          "kanthord.cause.category": "prompt",
          "kanthord.cause.subcategory": "context_missing",
          "kanthord.human.username": "ulrich",
        },
      ),
    ]);

    expect(screen.getByText("Labeled by ulrich")).toBeInTheDocument();
    expect(await screen.findByText("The prompt lacked the context.")).toBeInTheDocument();
  });

  it("shows the failure of the reason read", async () => {
    vi.mocked(readTraceText).mockRejectedValue(new ApiError("not_found", "No such text.", 404));
    renderBlock([
      ...PROVIDER_SPANS,
      span(
        "root.cause_label",
        "tracking.cause_label",
        {},
        {
          "kanthord.cause.category": "prompt",
          "kanthord.cause.subcategory": "context_missing",
          "kanthord.human.username": "ulrich",
        },
      ),
    ]);

    expect(await screen.findByRole("alert")).toHaveTextContent("No such text.");
  });

  it("shows the rework cause and the link to the evaluation trace", () => {
    renderBlock(
      [span("root", "scheduler.execution", { parent_span_id: null })],
      nodeTraces([
        execution({ traceId: "trace-1", current: true }),
        execution({
          traceId: "trace-2",
          kind: "evaluation",
          cause: { category: "model", subcategory: "work_defect", assigner: "reviewer" },
          path: "/traces/trace-2?tab=summary",
        }),
      ]),
    );

    expect(screen.getByText("Reworked by review")).toBeInTheDocument();
    expect(screen.getByText("Model - work defect")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open evaluation trace" })).toHaveAttribute(
      "href",
      "/traces/trace-2?tab=summary",
    );
    expect(screen.queryByRole("button", { name: "Label cause" })).not.toBeInTheDocument();
  });

  it("shows No failure with the count of recovered errors", () => {
    renderBlock([
      span("root", "scheduler.execution", { parent_span_id: null }),
      span("tool", "agent.tool", { status: "Error", end_time: 1500 }),
    ]);

    expect(screen.getByText("No failure")).toBeInTheDocument();
    expect(screen.getByText("Recovered errors: 1")).toBeInTheDocument();
  });
});
