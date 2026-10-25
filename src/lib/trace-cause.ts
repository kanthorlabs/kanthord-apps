import {
  CAUSE_ASSIGNERS,
  CAUSE_CATEGORIES,
  CAUSE_SUBCATEGORIES,
  type CauseAssigner,
  type CauseCategory,
  type CauseSubcategory,
  type EffectiveCause,
  type SpanAttributeValue,
  type TraceListItem,
  type TraceSpan,
} from "@/api/types";

import { durationText } from "./format";

export const CAUSE_LABEL_SUFFIX = ".cause_label";

const REASON_SUFFIX = ":reason";
const ATTRIBUTE_CATEGORY = "kanthord.cause.category";
const ATTRIBUTE_SUBCATEGORY = "kanthord.cause.subcategory";
const ATTRIBUTE_ASSIGNER = "kanthord.cause.assigner";
const ATTRIBUTE_SUSPECTS = "kanthord.cause.suspects";
const ATTRIBUTE_USERNAME = "kanthord.human.username";
const UNATTRIBUTED_LABEL = "Unattributed";

export const CAUSE_CATEGORY_LABELS: Readonly<Record<CauseCategory, string>> = {
  prompt: "Prompt",
  plan: "Plan",
  worker_action: "Worker action",
  llm_provider: "LLM provider",
  model: "Model",
  environment: "Environment",
  infrastructure: "Infrastructure",
  human: "Human",
  unattributed: UNATTRIBUTED_LABEL,
};

export function subcategoryText(subcategory: CauseSubcategory): string {
  return subcategory.replaceAll("_", " ");
}

export function causeLine(cause: EffectiveCause): string {
  const label = CAUSE_CATEGORY_LABELS[cause.category];
  if (cause.subcategory !== undefined) return `${label} - ${subcategoryText(cause.subcategory)}`;
  const suspects = cause.suspects ?? [];
  if (suspects.length === 0) return label;
  return `${label} - suspects ${suspects.map((suspect) => CAUSE_CATEGORY_LABELS[suspect]).join(", ")}`;
}

export function rowCauseLineOf(item: TraceListItem, now: number): string | null {
  if (item.state === "open") {
    if (item.started_at === null) return "Open";
    return `Open - ${durationText(item.duration_ms ?? Math.max(0, now - item.started_at))}`;
  }
  return item.cause === null ? null : causeLine(item.cause);
}

export function causeChipText(cause: EffectiveCause): string {
  return causeLine({ ...cause, suspects: cause.suspects?.slice(0, 1) });
}

export function causeLabelSpanIdOf(rootSpanId: string): string {
  return `${rootSpanId}${CAUSE_LABEL_SUFFIX}`;
}

export function causeLabelReasonTextIdOf(rootSpanId: string): string {
  return `${causeLabelSpanIdOf(rootSpanId)}${REASON_SUFFIX}`;
}

function isCategory(value: unknown): value is CauseCategory {
  return CAUSE_CATEGORIES.some((category) => category === value);
}

function isAssigner(value: unknown): value is CauseAssigner {
  return CAUSE_ASSIGNERS.some((assigner) => assigner === value);
}

function subcategoryOf(
  category: CauseCategory,
  value: SpanAttributeValue | undefined,
): CauseSubcategory | null {
  return CAUSE_SUBCATEGORIES[category].find((subcategory) => subcategory === value) ?? null;
}

function suspectsOf(value: SpanAttributeValue | undefined): readonly CauseCategory[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const suspects: readonly unknown[] = value;
  return suspects.every(isCategory) ? suspects : null;
}

function causeOfSpan(span: TraceSpan, assigner: string | undefined): EffectiveCause | null {
  const { attributes } = span;
  const category = attributes[ATTRIBUTE_CATEGORY];
  if (!isCategory(category) || !isAssigner(assigner)) return null;
  const rawSubcategory = attributes[ATTRIBUTE_SUBCATEGORY];
  const subcategory = subcategoryOf(category, rawSubcategory);
  if (rawSubcategory !== undefined && subcategory === null) return null;
  const suspects = suspectsOf(attributes[ATTRIBUTE_SUSPECTS]);
  if (suspects === null) return null;
  return {
    category,
    assigner,
    ...(subcategory === null ? {} : { subcategory }),
    ...(category === "unattributed" ? { suspects } : {}),
  };
}

function usernameOf(span: TraceSpan): string | null {
  const username = span.attributes[ATTRIBUTE_USERNAME];
  return typeof username === "string" ? username : null;
}

function rootAssignerOf(root: TraceSpan): string | undefined {
  const assigner = root.attributes[ATTRIBUTE_ASSIGNER];
  return typeof assigner === "string" ? assigner : undefined;
}

export function spanCauseOf(
  spans: readonly TraceSpan[],
  rootSpanId: string,
): { cause: EffectiveCause; labeledBy: string | null } | null {
  const labelSpanId = causeLabelSpanIdOf(rootSpanId);
  const label = spans.find(
    (span) => span.span_id === labelSpanId && ATTRIBUTE_CATEGORY in span.attributes,
  );
  if (label !== undefined) {
    const cause = causeOfSpan(label, "human");
    return cause === null ? null : { cause, labeledBy: usernameOf(label) };
  }
  const root = spans.find(
    (span) => span.span_id === rootSpanId && ATTRIBUTE_CATEGORY in span.attributes,
  );
  if (root === undefined) return null;
  const cause = causeOfSpan(root, rootAssignerOf(root));
  return cause === null ? null : { cause, labeledBy: null };
}

export function isRepeat(previous: EffectiveCause | null, current: EffectiveCause | null): boolean {
  if (previous === null || current === null) return false;
  return previous.category === current.category && previous.subcategory === current.subcategory;
}
