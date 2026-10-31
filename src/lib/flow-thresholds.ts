import type { FlowBounds, FlowUnit } from "./flow-status";

export type FlowBoundSpec = number | { readonly times: number } | null;

export interface FlowThreshold {
  readonly unit: FlowUnit;
  readonly direction: "high" | "low";
  readonly warn: FlowBoundSpec;
  readonly bad: FlowBoundSpec;
  readonly floor?: number;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

const LEAK = { unit: "ratio", direction: "high", warn: 0.15, bad: 0.25 } as const;
const PROVIDER_TURNS = {
  unit: "count",
  direction: "high",
  warn: { times: 3 },
  bad: null,
  floor: 10,
} as const;
const SLOWER_THAN_PREVIOUS = {
  unit: "ms",
  direction: "high",
  warn: { times: 1.5 },
  bad: null,
} as const;

export const FLOW_THRESHOLDS = {
  "queued.wait": { unit: "ms", direction: "high", warn: 15 * MINUTE_MS, bad: HOUR_MS },
  "executing.leak": LEAK,
  "evaluation.leak": LEAK,
  "executing.turn_rate_limited": PROVIDER_TURNS,
  "executing.turn_quota_exhausted": PROVIDER_TURNS,
  "executing.turn_unavailable": PROVIDER_TURNS,
  "executing.tool_error": { unit: "ratio", direction: "high", warn: 0.1, bad: null },
  "executing.time": SLOWER_THAN_PREVIOUS,
  "verification.time": SLOWER_THAN_PREVIOUS,
  "release_gate.time": SLOWER_THAN_PREVIOUS,
  "evaluation.time": SLOWER_THAN_PREVIOUS,
  "verification.flaky": { unit: "ratio", direction: "high", warn: 0.08, bad: 0.15 },
  "verification.loops": { unit: "ratio2", direction: "high", warn: 0.75, bad: null },
  "verification.fail": { unit: "ratio", direction: "high", warn: 0.35, bad: null },
  "verification.base_red": { unit: "ratio", direction: "high", warn: 0.05, bad: null },
  "release_gate.leak": { unit: "ratio", direction: "high", warn: 0.05, bad: 0.1 },
  "evaluation.review": { unit: "ms", direction: "high", warn: HOUR_MS, bad: 4 * HOUR_MS },
  "outcome.rework": { unit: "ratio", direction: "high", warn: 0.25, bad: 0.4 },
  "outcome.blocked": { unit: "ratio", direction: "high", warn: 0.05, bad: 0.1 },
  "tile.cost_per_success": {
    unit: "usd",
    direction: "high",
    warn: { times: 1.25 },
    bad: { times: 1.5 },
  },
  "tile.tokens_per_success": {
    unit: "tokens",
    direction: "high",
    warn: { times: 1.25 },
    bad: { times: 1.5 },
  },
  "tile.leaked_share": { unit: "ratio", direction: "high", warn: 0.1, bad: 0.2 },
  "tile.cache_hit": { unit: "ratio", direction: "low", warn: 0.6, bad: 0.4 },
  "causes.unattributed": { unit: "ratio", direction: "high", warn: 0.25, bad: 0.4 },
  "data.awaiting": { unit: "count", direction: "high", warn: 0, bad: null },
  "data.completeness": { unit: "ratio", direction: "low", warn: 0.98, bad: null },
} as const satisfies Readonly<Record<string, FlowThreshold>>;

export type FlowThresholdId = keyof typeof FLOW_THRESHOLDS;

export const MIN_SETTLED = 5;
export const MIN_SUCCESS = 10;
export const MIN_MODEL_TURNS = 50;

function resolved(spec: FlowBoundSpec, reference: number | null): number | null | undefined {
  if (spec === null || typeof spec === "number") return spec;
  return reference === null ? undefined : spec.times * reference;
}

export function boundsOf(id: FlowThresholdId, reference: number | null = null): FlowBounds | null {
  const threshold: FlowThreshold = FLOW_THRESHOLDS[id];
  const warn = resolved(threshold.warn, reference);
  const bad = resolved(threshold.bad, reference);
  if (warn === undefined || bad === undefined) return null;
  return { direction: threshold.direction, warn, bad, floor: threshold.floor ?? null };
}
