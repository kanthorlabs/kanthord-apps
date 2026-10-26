import { describe, expect, it } from "vitest";

import type { EffectiveCause, SpanAttributeValue, TraceListItem, TraceSpan } from "@/api/types";

import {
  CAUSE_CATEGORY_LABELS,
  CAUSE_LABEL_SUFFIX,
  causeLabelReasonTextIdOf,
  causeLabelSpanIdOf,
  causeChipText,
  causeLine,
  isRepeat,
  rowCauseLineOf,
  spanCauseOf,
  subcategoryText,
} from "./trace-cause";

const ROOT = "root_1";

function span(id: string, attributes: Record<string, SpanAttributeValue>): TraceSpan {
  return {
    trace_id: "trace_1",
    span_id: id,
    parent_span_id: id === ROOT ? null : ROOT,
    producer: "worker",
    origin: "observed",
    operation: "scheduler.execution",
    start_time: 1,
    end_time: 2,
    status: "Error",
    attributes,
    events: [],
    links: [],
    text_ids: [],
    created_at: 1,
  };
}

const rootWith = (attributes: Record<string, SpanAttributeValue>) => span(ROOT, attributes);

const labelWith = (attributes: Record<string, SpanAttributeValue>) =>
  span(`${ROOT}${CAUSE_LABEL_SUFFIX}`, attributes);

describe("cause labels", () => {
  it("names the nine categories", () => {
    expect(Object.values(CAUSE_CATEGORY_LABELS)).toEqual([
      "Prompt",
      "Plan",
      "Worker action",
      "LLM provider",
      "Model",
      "Environment",
      "Infrastructure",
      "Human",
      "Unattributed",
    ]);
  });

  it("replaces each underscore of a subcategory with a space", () => {
    expect(subcategoryText("verification_insufficient")).toBe("verification insufficient");
    expect(subcategoryText("rate_limited")).toBe("rate limited");
  });

  it("builds the label span id and the reason text id", () => {
    expect(causeLabelSpanIdOf(ROOT)).toBe("root_1.cause_label");
    expect(causeLabelReasonTextIdOf(ROOT)).toBe("root_1.cause_label:reason");
  });
});

describe("causeLine", () => {
  it("joins the category label and the subcategory text", () => {
    expect(
      causeLine({ category: "llm_provider", assigner: "rule", subcategory: "rate_limited" }),
    ).toBe("LLM provider - rate limited");
  });

  it("lists the suspects in their order", () => {
    expect(
      causeLine({
        category: "unattributed",
        assigner: "rule",
        suspects: ["plan", "worker_action"],
      }),
    ).toBe("Unattributed - suspects Plan, Worker action");
  });

  it("shows the category alone when no suspect remains", () => {
    expect(causeLine({ category: "unattributed", assigner: "rule", suspects: [] })).toBe(
      "Unattributed",
    );
  });
});

describe("causeChipText", () => {
  it("joins the category label and the subcategory text", () => {
    expect(
      causeChipText({ category: "llm_provider", assigner: "rule", subcategory: "rate_limited" }),
    ).toBe("LLM provider - rate limited");
  });

  it("keeps the first suspect of an unattributed cause", () => {
    expect(
      causeChipText({
        category: "unattributed",
        assigner: "rule",
        suspects: ["plan", "worker_action"],
      }),
    ).toBe("Unattributed - suspects Plan");
  });
});

describe("spanCauseOf", () => {
  const rootCause = {
    "kanthord.cause.category": "llm_provider",
    "kanthord.cause.assigner": "rule",
    "kanthord.cause.subcategory": "rate_limited",
  };

  it("reads the cause of the root span", () => {
    expect(spanCauseOf([rootWith(rootCause)], ROOT)).toEqual({
      cause: { category: "llm_provider", assigner: "rule", subcategory: "rate_limited" },
      labeledBy: null,
    });
  });

  it("reads the suspects of an unattributed root cause", () => {
    const root = rootWith({
      "kanthord.cause.category": "unattributed",
      "kanthord.cause.assigner": "rule",
      "kanthord.cause.suspects": ["plan", "model"],
    });

    expect(spanCauseOf([root], ROOT)?.cause).toEqual({
      category: "unattributed",
      assigner: "rule",
      suspects: ["plan", "model"],
    });
  });

  it("gives an unattributed root cause with no suspects an empty list", () => {
    const root = rootWith({
      "kanthord.cause.category": "unattributed",
      "kanthord.cause.assigner": "rule",
    });

    expect(spanCauseOf([root], ROOT)?.cause).toEqual({
      category: "unattributed",
      assigner: "rule",
      suspects: [],
    });
  });

  it("prefers the label over the root cause", () => {
    const label = labelWith({
      "kanthord.cause.category": "model",
      "kanthord.cause.subcategory": "work_defect",
      "kanthord.human.username": "ada",
    });

    expect(spanCauseOf([rootWith(rootCause), label], ROOT)).toEqual({
      cause: { category: "model", assigner: "human", subcategory: "work_defect" },
      labeledBy: "ada",
    });
  });

  it("answers null when no span holds a category", () => {
    expect(spanCauseOf([rootWith({}), labelWith({})], ROOT)).toBeNull();
    expect(spanCauseOf([], ROOT)).toBeNull();
  });

  it("falls back to the root cause when the label holds no category", () => {
    expect(spanCauseOf([rootWith(rootCause), labelWith({})], ROOT)?.cause.category).toBe(
      "llm_provider",
    );
  });

  it.each([
    ["category", { ...rootCause, "kanthord.cause.category": "weather" }],
    ["subcategory", { ...rootCause, "kanthord.cause.subcategory": "work_defect" }],
    ["assigner", { ...rootCause, "kanthord.cause.assigner": "robot" }],
    [
      "suspect",
      {
        "kanthord.cause.category": "unattributed",
        "kanthord.cause.assigner": "rule",
        "kanthord.cause.suspects": ["plan", "weather"],
      },
    ],
  ])("answers null for an unknown %s", (_name, attributes) => {
    expect(spanCauseOf([rootWith(attributes)], ROOT)).toBeNull();
  });

  it("answers null for an unknown label category", () => {
    const label = labelWith({
      "kanthord.cause.category": "weather",
      "kanthord.cause.subcategory": "work_defect",
    });

    expect(spanCauseOf([rootWith(rootCause), label], ROOT)).toBeNull();
  });
});

describe("isRepeat", () => {
  const rate: EffectiveCause = {
    category: "llm_provider",
    assigner: "rule",
    subcategory: "rate_limited",
  };

  it("matches the same category and subcategory", () => {
    expect(isRepeat(rate, { ...rate, assigner: "human" })).toBe(true);
  });

  it("rejects another subcategory, another category and a missing cause", () => {
    expect(isRepeat(rate, { ...rate, subcategory: "unavailable" })).toBe(false);
    expect(
      isRepeat(rate, { category: "model", assigner: "rule", subcategory: "work_defect" }),
    ).toBe(false);
    expect(isRepeat(null, rate)).toBe(false);
    expect(isRepeat(rate, null)).toBe(false);
    expect(isRepeat(null, null)).toBe(false);
  });

  it("matches two causes with no subcategory of the same category", () => {
    const unattributed: EffectiveCause = { category: "unattributed", assigner: "rule" };

    expect(isRepeat(unattributed, unattributed)).toBe(true);
  });
});

describe("rowCauseLineOf", () => {
  const NOW = 1_000_000;
  const row = (overrides: Partial<TraceListItem>): TraceListItem =>
    ({
      state: "error",
      started_at: NOW - 90_000,
      duration_ms: null,
      cause: null,
      ...overrides,
    }) as TraceListItem;

  it("answers the cause line of a row with a cause", () => {
    const cause: EffectiveCause = {
      category: "llm_provider",
      assigner: "rule",
      subcategory: "rate_limited",
    };
    expect(rowCauseLineOf(row({ cause }), NOW)).toBe("LLM provider - rate limited");
  });

  it("answers the elapsed time of an open row", () => {
    expect(rowCauseLineOf(row({ state: "open" }), NOW)).toBe("Open - 1 m");
  });

  it("answers Open for an open row that has not started", () => {
    expect(rowCauseLineOf(row({ state: "open", started_at: null }), NOW)).toBe("Open");
  });

  it("answers nothing for a row with no cause", () => {
    expect(rowCauseLineOf(row({ state: "ok" }), NOW)).toBeNull();
  });
});
