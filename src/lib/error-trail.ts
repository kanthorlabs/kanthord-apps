import type { TraceSpan } from "@/api/types";

import { type ErrorRole, errorRolesOf, errorSteps, pickCausalSpan } from "./causal-span";
import { attributeText, isTurn } from "./span-detail";

const ATTRIBUTE_STOP_REASON = "kanthord.stop.reason";
const ATTRIBUTE_STOP_DETAIL = "kanthord.stop.detail";
const STOP_PROVIDER_FAILED = "provider_failed";

export interface ProviderFailure {
  readonly spanId: string;
  readonly detail: string;
}

export interface ErrorTrail {
  readonly roles: ReadonlyMap<string, ErrorRole>;
  readonly steps: readonly string[];
  readonly providerFailure: ProviderFailure | null;
}

export interface ErrorNeighbours {
  readonly previous: string | null;
  readonly next: string | null;
}

function providerFailureOf(
  root: TraceSpan | null,
  causal: TraceSpan | null,
): ProviderFailure | null {
  if (root === null || causal === null || !isTurn(causal)) return null;
  const reason = root.attributes[ATTRIBUTE_STOP_REASON];
  const detail = root.attributes[ATTRIBUTE_STOP_DETAIL];
  if (reason !== STOP_PROVIDER_FAILED || detail === undefined) return null;
  return { spanId: causal.span_id, detail: attributeText(detail) };
}

export function errorTrailOf(spans: readonly TraceSpan[]): ErrorTrail {
  const root = spans.find((span) => span.parent_span_id === null) ?? null;
  const causal = root === null ? null : pickCausalSpan(spans, root.span_id);
  const roles = errorRolesOf(spans, causal);
  return {
    roles,
    steps: errorSteps(spans, roles),
    providerFailure: providerFailureOf(root, causal),
  };
}

export function errorNeighbours(steps: readonly string[], spanId: string): ErrorNeighbours {
  const index = steps.indexOf(spanId);
  if (index === -1) return { previous: steps.at(-1) ?? null, next: steps[0] ?? null };
  return { previous: steps[index - 1] ?? null, next: steps[index + 1] ?? null };
}
