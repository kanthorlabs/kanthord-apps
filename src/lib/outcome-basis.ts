import type { Assessment, Attempt, Outcome } from "@/api/types";

export type BasisKind = "execution assessment" | "human assessment";

export function basisAssessment(attempt: Attempt, outcome: Outcome): Assessment {
  const assessment = attempt.assessments.find((item) => item.id === outcome.assessmentId);
  if (assessment === undefined) {
    throw new Error(`Outcome ${outcome.id} names missing assessment ${outcome.assessmentId}`);
  }
  return assessment;
}

export function basisKind(assessment: Assessment): BasisKind {
  return assessment.actor.kind === "execution" ? "execution assessment" : "human assessment";
}
