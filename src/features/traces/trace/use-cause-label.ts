import { useState } from "react";

import { ApiError } from "@/api/errors";
import { labelTraceCause } from "@/api/resources/tracking";
import {
  CAUSE_SUBCATEGORIES,
  type CauseCategory,
  type CauseLabel,
  type CauseSubcategory,
  type EffectiveCause,
} from "@/api/types";

export interface CauseLabelDraft {
  readonly category: CauseCategory;
  readonly subcategory: CauseSubcategory | null;
  readonly reason: string;
}

export interface CauseLabelErrors {
  readonly category?: string;
  readonly subcategory?: string;
  readonly reason?: string;
}

export interface CauseLabelState {
  readonly draft: CauseLabelDraft;
  readonly errors: CauseLabelErrors;
  readonly valid: boolean;
  readonly pending: boolean;
  readonly failure: string | null;
  readonly setCategory: (category: CauseCategory) => void;
  readonly setSubcategory: (subcategory: CauseSubcategory) => void;
  readonly setReason: (reason: string) => void;
  readonly submit: () => void;
}

const REASON_MAX = 4096;
const TRACE_OPEN = "tracking.cause.trace_open";
const TRACE_OPEN_MESSAGE = "The trace is still open. Label it after it ends.";
const CATEGORY_ERROR = "Choose a category. Unattributed is not a label.";
const SUBCATEGORY_ERROR = "Choose a subcategory of the category.";
const REASON_ERROR = `Write a reason of 1 to ${REASON_MAX} characters.`;

function firstSubcategoryOf(category: CauseCategory): CauseSubcategory | null {
  return CAUSE_SUBCATEGORIES[category][0] ?? null;
}

function startOf(cause: EffectiveCause): CauseLabelDraft {
  const category =
    cause.category === "unattributed" ? (cause.suspects?.[0] ?? cause.category) : cause.category;
  const subcategory = CAUSE_SUBCATEGORIES[category].find((entry) => entry === cause.subcategory);
  return { category, subcategory: subcategory ?? firstSubcategoryOf(category), reason: "" };
}

function errorsOf(draft: CauseLabelDraft): CauseLabelErrors {
  const reasonLength = draft.reason.trim().length;
  const subcategories: readonly CauseSubcategory[] = CAUSE_SUBCATEGORIES[draft.category];
  const subcategoryBelongs =
    draft.subcategory !== null && subcategories.includes(draft.subcategory);
  return {
    ...(draft.category === "unattributed" ? { category: CATEGORY_ERROR } : {}),
    ...(subcategoryBelongs ? {} : { subcategory: SUBCATEGORY_ERROR }),
    ...(reasonLength >= 1 && reasonLength <= REASON_MAX ? {} : { reason: REASON_ERROR }),
  };
}

function failureOf(cause: unknown): string {
  if (!(cause instanceof ApiError)) throw cause;
  return cause.detail === TRACE_OPEN ? TRACE_OPEN_MESSAGE : cause.message;
}

export function useCauseLabel(
  traceId: string,
  cause: EffectiveCause,
  onLabeled: (label: CauseLabel) => void,
): CauseLabelState {
  const [draft, setDraft] = useState<CauseLabelDraft>(() => startOf(cause));
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const errors = errorsOf(draft);
  const valid = Object.keys(errors).length === 0;

  const submit = () => {
    if (!valid || pending || draft.category === "unattributed" || draft.subcategory === null) {
      return;
    }
    const body = {
      category: draft.category,
      subcategory: draft.subcategory,
      reason: draft.reason.trim(),
    };
    setPending(true);
    setFailure(null);
    labelTraceCause(traceId, body).then(
      (label) => {
        setPending(false);
        onLabeled(label);
      },
      (error: unknown) => {
        setPending(false);
        setFailure(failureOf(error));
      },
    );
  };

  return {
    draft,
    errors,
    valid,
    pending,
    failure,
    setCategory: (category) =>
      setDraft({ ...draft, category, subcategory: firstSubcategoryOf(category) }),
    setSubcategory: (subcategory) => setDraft({ ...draft, subcategory }),
    setReason: (reason) => setDraft({ ...draft, reason }),
    submit,
  };
}
