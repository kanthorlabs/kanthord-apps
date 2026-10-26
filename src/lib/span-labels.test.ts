import { describe, expect, it } from "vitest";

import type { SpanAttributeValue, TraceSpan } from "@/api/types";

import { operationLabel, revocationLabel, spanDetail, spanGroup, spanLabel } from "./span-labels";

function span(operation: string, attributes: Record<string, SpanAttributeValue> = {}): TraceSpan {
  return {
    trace_id: "trace_1",
    span_id: "span_1",
    parent_span_id: null,
    producer: "worker",
    origin: "observed",
    operation,
    start_time: 1,
    end_time: 2,
    status: "Ok",
    attributes,
    events: [],
    links: [],
    text_ids: [],
    created_at: 1,
  };
}

describe("spanLabel", () => {
  it.each([
    ["scheduler.execution", {}, "Execution"],
    ["worker.phase", { "kanthord.phase": "build" }, "Phase build"],
    ["worker.task", { "kanthord.task.id": "node_7" }, "Task node_7"],
    ["worker.verification", { "kanthord.verification.index": 2 }, "Verification 2"],
    [
      "worker.verification",
      { "kanthord.verification.kind": "listed", "kanthord.verification.index": 2 },
      "Verification 2",
    ],
    ["worker.verification", { "kanthord.verification.kind": "affected" }, "Affected tests"],
    [
      "worker.verification",
      { "kanthord.verification.kind": "affected_base" },
      "Affected tests on base",
    ],
    ["worker.judgement", {}, "Judgement"],
    ["worker.evaluation", {}, "Evaluation"],
    ["worker.git", { "kanthord.git.step": "commit" }, "Git commit"],
    ["worker.gate", { "kanthord.gate.mode": "auto" }, "Gate auto"],
    ["agent.prompt", { "kanthord.agent.name": "coder" }, "Prompt coder"],
    ["tracking.cause_label", {}, "Cause label"],
    ["agent.session", { "kanthord.agent.name": "coder" }, "Session coder"],
    ["agent.turn", { "kanthord.turn.index": 3 }, "Turn 3"],
    ["agent.tool", { "gen_ai.tool.name": "bash" }, "bash"],
    ["agent.progress", {}, "Progress"],
    ["project.environment", { "project.binding.name": "main" }, "Environment main"],
    ["environment.build", {}, "Build"],
    ["environment.setup", {}, "Setup"],
    ["environment.proof", {}, "Proof"],
    ["custom.operation", {}, "custom.operation"],
  ] satisfies [string, Record<string, SpanAttributeValue>, string][])(
    "labels %s",
    (operation, attributes, label) => {
      expect(spanLabel(span(operation, attributes))).toBe(label);
    },
  );

  it("labels a transition with its states", () => {
    expect(
      spanLabel(
        span("scheduler.transition", {
          "kanthord.node.state.from": "Executing",
          "kanthord.node.state.to": "Paused",
        }),
      ),
    ).toBe("Transition Executing -> Paused");
  });

  it.each([
    ["mission.node.pause", "Paused"],
    ["mission.node.resume", "Resumed"],
    ["mission.node.ready", "Ready"],
    ["mission.node.block", "Blocked"],
    ["mission.node.unblock", "Unblocked"],
    ["mission.node.discard", "Discarded"],
    ["mission.node.override", "Overridden"],
    ["mission.proposal.approve", "Proposal approved"],
    ["mission.evidence.delete", "Evidence deleted"],
  ])("labels the act %s as %s", (operation, label) => {
    expect(spanLabel(span(operation))).toBe(label);
  });

  it("labels an operation with its attributes and no span", () => {
    expect(operationLabel("project.environment", { "project.binding.name": "main" })).toBe(
      "Environment main",
    );
    expect(operationLabel("project.environment", {})).toBe("Environment");
  });

  it("leaves the label without its value when the attribute is absent", () => {
    expect(spanLabel(span("worker.phase"))).toBe("Phase");
    expect(spanLabel(span("agent.turn"))).toBe("Turn");
    expect(spanLabel(span("worker.gate"))).toBe("Gate");
    expect(spanLabel(span("agent.prompt"))).toBe("Prompt");
  });
});

describe("spanGroup", () => {
  it.each([
    ["agent.session", "agent"],
    ["agent.turn", "agent"],
    ["agent.progress", "agent"],
    ["agent.tool", "tools"],
    ["worker.verification", "checks"],
    ["worker.judgement", "checks"],
    ["worker.evaluation", "checks"],
    ["worker.git", "git"],
    ["worker.gate", "git"],
    ["worker.task", "other"],
    ["scheduler.execution", "other"],
  ] as const)("groups %s as %s", (operation, group) => {
    expect(spanGroup(span(operation))).toBe(group);
  });
});

describe("spanDetail", () => {
  const transition = (attributes: Record<string, SpanAttributeValue>) =>
    span("scheduler.transition", {
      "kanthord.node.state.from": "Executing",
      "kanthord.node.state.to": "Paused",
      ...attributes,
    });

  it("shows no detail for a transition without a rule", () => {
    expect(spanDetail(transition({ "kanthord.transition.rule": "none" }))).toBeNull();
    expect(spanDetail(transition({}))).toBeNull();
  });

  it.each([
    ["failure_limit", "Paused at the failure limit: 3 of 5"],
    ["further_work_limit", "Paused at the further work limit: 3 of 5"],
    ["rework_limit", "Blocked at the rework limit: 3 of 5"],
  ])("shows the detail of the rule %s", (rule, detail) => {
    expect(
      spanDetail(
        transition({
          "kanthord.transition.rule": rule,
          "kanthord.transition.count": 3,
          "kanthord.transition.limit": 5,
        }),
      ),
    ).toBe(detail);
  });

  it.each(["steps", "evaluation"])("shows the kind %s of an execution", (kind) => {
    expect(spanDetail(span("scheduler.execution", { "kanthord.execution.kind": kind }))).toBe(kind);
  });

  it.each([
    ["assessment", "evaluation - Revoked by a review"],
    ["human", "evaluation - Revoked by a human"],
  ])("shows the revoke cause %s of an execution", (cause, detail) => {
    expect(
      spanDetail(
        span("scheduler.execution", {
          "kanthord.execution.kind": "evaluation",
          "kanthord.execution.end": "revoked",
          "kanthord.revoke.cause": cause,
        }),
      ),
    ).toBe(detail);
  });

  it("shows no revocation for an execution that finished or was lost", () => {
    expect(
      spanDetail(
        span("scheduler.execution", {
          "kanthord.execution.kind": "steps",
          "kanthord.execution.end": "lost",
        }),
      ),
    ).toBe("steps");
  });

  it("shows no detail for another span", () => {
    expect(spanDetail(span("agent.turn"))).toBeNull();
    expect(spanDetail(span("scheduler.execution"))).toBeNull();
  });
});

describe("revocationLabel", () => {
  it.each([
    ["assessment", "Revoked by a review"],
    ["human", "Revoked by a human"],
  ])("names the revoke cause %s of a revoked execution", (cause, label) => {
    expect(
      revocationLabel(
        span("scheduler.execution", {
          "kanthord.execution.end": "revoked",
          "kanthord.revoke.cause": cause,
        }),
      ),
    ).toBe(label);
  });

  it("answers null without a known cause or for an execution that was not revoked", () => {
    expect(
      revocationLabel(span("scheduler.execution", { "kanthord.execution.end": "revoked" })),
    ).toBeNull();
    expect(
      revocationLabel(
        span("scheduler.execution", {
          "kanthord.execution.end": "lost",
          "kanthord.revoke.cause": "human",
        }),
      ),
    ).toBeNull();
  });
});
