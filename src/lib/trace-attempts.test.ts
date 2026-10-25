import { describe, expect, it } from "vitest";

import type { EffectiveCause, MissionAttempt, TraceListItem } from "@/api/types";

import { attemptGroups, repeatAdvice } from "./trace-attempts";

function item(id: string, attempt: number | null, overrides: Partial<TraceListItem> = {}) {
  return {
    trace_id: id,
    attempt,
    created_at: 1000,
    state: "ok",
    duration_ms: 50,
    root_attributes: null,
    cause: null,
    ...overrides,
  } as TraceListItem;
}

function attempt(number: number, revision: number): MissionAttempt {
  return { attempt: number, node_revision: revision } as MissionAttempt;
}

function cause(category: EffectiveCause["category"]): EffectiveCause {
  return { category, assigner: "rule" };
}

const ITEMS = [
  item("late", 2, { created_at: 3000, root_attributes: { "kanthord.execution.kind": "steps" } }),
  item("second", 1, {
    created_at: 2000,
    state: "error",
    duration_ms: null,
    cause: cause("model"),
    root_attributes: { "kanthord.execution.kind": "evaluation" },
  }),
  item("first", 1, { created_at: 1000, root_attributes: { "kanthord.execution.kind": "steps" } }),
  item("unattempted", null),
];

describe("attemptGroups", () => {
  it("groups two attempts newest first with the executions in creation order", () => {
    const groups = attemptGroups(ITEMS, [attempt(1, 1), attempt(2, 1)]);

    expect(groups.map((group) => group.attempt)).toEqual([2, 1]);
    expect(groups[1]?.executions.map((execution) => execution.traceId)).toEqual([
      "first",
      "second",
    ]);
    expect(groups[0]?.executions.map((execution) => execution.traceId)).toEqual(["late"]);
  });

  it("reads the kind, the state, the duration and the cause of an execution", () => {
    const [, older] = attemptGroups(ITEMS, [attempt(1, 1), attempt(2, 1)]);

    expect(older?.executions).toEqual([
      { traceId: "first", kind: "steps", state: "ok", duration_ms: 50, cause: null },
      {
        traceId: "second",
        kind: "evaluation",
        state: "error",
        duration_ms: null,
        cause: cause("model"),
      },
    ]);
  });

  it("reads a missing or unknown kind as null", () => {
    const groups = attemptGroups(
      [item("a", 1), item("b", 1, { root_attributes: { "kanthord.execution.kind": "other" } })],
      [attempt(1, 1)],
    );

    expect(groups[0]?.executions.map((execution) => execution.kind)).toEqual([null, null]);
  });

  it("takes the node revision of each attempt", () => {
    const groups = attemptGroups(ITEMS, [attempt(1, 3), attempt(2, 4)]);

    expect(groups.map((group) => group.nodeRevision)).toEqual([4, 3]);
  });

  it("marks an attempt whose node revision differs from the attempt before it", () => {
    const changed = attemptGroups(ITEMS, [attempt(1, 1), attempt(2, 2)]);
    const same = attemptGroups(ITEMS, [attempt(1, 2), attempt(2, 2)]);

    expect(changed.map((group) => group.planChanged)).toEqual([true, false]);
    expect(same.map((group) => group.planChanged)).toEqual([false, false]);
  });

  it("returns no group for no items", () => {
    expect(attemptGroups([], [attempt(1, 1)])).toEqual([]);
  });
});

describe("repeatAdvice", () => {
  it.each(["plan", "prompt"] as const)("advises a change for the category %s", (category) => {
    expect(repeatAdvice(cause(category))).toBe(
      "A retry does not fix this. Change the plan or the prompt.",
    );
  });

  it.each(["model", "environment", "unattributed"] as const)(
    "gives no advice for the category %s",
    (category) => {
      expect(repeatAdvice(cause(category))).toBeNull();
    },
  );
});
