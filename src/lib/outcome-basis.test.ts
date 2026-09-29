import { describe, expect, it } from "vitest";

import type { Assessment, Attempt, Outcome } from "@/api/types";
import { basisAssessment, basisKind } from "./outcome-basis";

const executionAssessment: Assessment = {
  id: "as-execution",
  attemptId: "att-1",
  nodeRevisionId: "rev-1",
  evidenceIds: [],
  childOutcomeIds: [],
  verdict: "meets",
  method: "review",
  actor: { kind: "execution", executionId: "exec-1", clientId: null, name: "reviewer" },
  time: "2025-01-01T00:00:00Z",
  currency: { context: true, authority: true, order: true },
};

const humanAssessment: Assessment = {
  ...executionAssessment,
  id: "as-human",
  actor: { kind: "human", account: "ulrich", name: "ulrich" },
  currency: null,
};

const outcome: Outcome = {
  id: "oc-1",
  attemptId: "att-1",
  assertedResult: "success",
  closingEvent: "Completed.",
  stoppingReason: "Done.",
  assessmentId: "as-execution",
  evidenceIds: [],
  previousOutcomeId: null,
  actor: "reviewer",
  time: "2025-01-01T00:00:00Z",
};

const attempt: Attempt = {
  id: "att-1",
  nodeId: "node-1",
  ordinal: 1,
  pinnedRevisionId: "rev-1",
  open: false,
  openedAt: "2025-01-01T00:00:00Z",
  closedAt: "2025-01-01T00:00:00Z",
  evidence: [],
  assessments: [executionAssessment, humanAssessment],
  outcome,
  externalObjects: [],
};

describe("outcome basis", () => {
  it("resolves an execution assessment", () => {
    const assessment = basisAssessment(attempt, outcome);
    expect(assessment).toBe(executionAssessment);
    expect(basisKind(assessment)).toBe("execution assessment");
  });

  it("resolves a human assessment", () => {
    const assessment = basisAssessment(attempt, { ...outcome, assessmentId: "as-human" });
    expect(assessment).toBe(humanAssessment);
    expect(basisKind(assessment)).toBe("human assessment");
  });

  it("fails when the named assessment is absent", () => {
    expect(() => basisAssessment(attempt, { ...outcome, assessmentId: "as-missing" })).toThrow(
      "Outcome oc-1 names missing assessment as-missing",
    );
  });
});
