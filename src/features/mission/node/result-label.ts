import type { AssertedResult, AssessmentVerdict } from "@/api/types";

export type ResultLabel = "success" | "criterion-not-met" | "undetermined";

const VERDICT_RESULTS: Record<AssessmentVerdict, ResultLabel> = {
  meets: "success",
  "does not meet": "criterion-not-met",
  "neither established": "undetermined",
};

const ASSERTED_RESULTS: Record<AssertedResult, ResultLabel> = {
  success: "success",
  "criteria not met": "criterion-not-met",
  "nothing established": "undetermined",
};

export function verdictResult(verdict: AssessmentVerdict): ResultLabel {
  return VERDICT_RESULTS[verdict];
}

export function assertedResult(result: AssertedResult): ResultLabel {
  return ASSERTED_RESULTS[result];
}
