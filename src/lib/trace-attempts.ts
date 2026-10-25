import type { EffectiveCause, MissionAttempt, TraceListItem, TraceState } from "@/api/types";

export type ExecutionKind = "steps" | "evaluation";

export interface AttemptExecution {
  readonly traceId: string;
  readonly kind: ExecutionKind | null;
  readonly state: TraceState;
  readonly duration_ms: number | null;
  readonly cause: EffectiveCause | null;
}

export interface AttemptGroup {
  readonly attempt: number;
  readonly nodeRevision: number | null;
  readonly planChanged: boolean;
  readonly executions: readonly AttemptExecution[];
}

const ATTRIBUTE_EXECUTION_KIND = "kanthord.execution.kind";
const KIND_STEPS = "steps";
const KIND_EVALUATION = "evaluation";
const REPEAT_ADVICE = "A retry does not fix this. Change the plan or the prompt.";
const ADVISED_CATEGORIES: readonly string[] = ["plan", "prompt"];

function kindOf(item: TraceListItem): ExecutionKind | null {
  const value = item.root_attributes?.[ATTRIBUTE_EXECUTION_KIND];
  return value === KIND_STEPS || value === KIND_EVALUATION ? value : null;
}

function executionOf(item: TraceListItem): AttemptExecution {
  return {
    traceId: item.trace_id,
    kind: kindOf(item),
    state: item.state,
    duration_ms: item.duration_ms,
    cause: item.cause,
  };
}

function itemsByAttempt(items: readonly TraceListItem[]): ReadonlyMap<number, TraceListItem[]> {
  const groups = new Map<number, TraceListItem[]>();
  for (const item of items) {
    if (item.attempt === null) continue;
    groups.set(item.attempt, [...(groups.get(item.attempt) ?? []), item]);
  }
  return groups;
}

export function attemptGroups(
  items: readonly TraceListItem[],
  attempts: readonly MissionAttempt[],
): readonly AttemptGroup[] {
  const revisions = new Map(attempts.map((entry) => [entry.attempt, entry.node_revision]));
  const grouped = itemsByAttempt(items);
  const numbers = [...grouped.keys()].sort((a, b) => a - b);
  const groups = numbers.map((attempt, index) => {
    const revision = revisions.get(attempt) ?? null;
    const previous = index === 0 ? null : (revisions.get(numbers[index - 1] ?? attempt) ?? null);
    return {
      attempt,
      nodeRevision: revision,
      planChanged: revision !== null && previous !== null && revision !== previous,
      executions: (grouped.get(attempt) ?? [])
        .sort((a, b) => a.created_at - b.created_at)
        .map(executionOf),
    };
  });
  return groups.reverse();
}

export function repeatAdvice(cause: EffectiveCause): string | null {
  return ADVISED_CATEGORIES.includes(cause.category) ? REPEAT_ADVICE : null;
}
