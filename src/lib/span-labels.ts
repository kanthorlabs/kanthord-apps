import type {
  ActOperation,
  RevokeCause,
  SpanAttributeValue,
  TraceSpan,
  TransitionRule,
} from "@/api/types";

const OPERATION_EXECUTION = "scheduler.execution";
const OPERATION_PHASE = "worker.phase";
const OPERATION_TASK = "worker.task";
const OPERATION_VERIFICATION = "worker.verification";
const OPERATION_JUDGEMENT = "worker.judgement";
const OPERATION_EVALUATION = "worker.evaluation";
const OPERATION_GIT = "worker.git";
const OPERATION_SESSION = "agent.session";
const OPERATION_TURN = "agent.turn";
const OPERATION_TOOL = "agent.tool";
const OPERATION_PROGRESS = "agent.progress";
const OPERATION_TRANSITION = "scheduler.transition";
const OPERATION_ENVIRONMENT = "project.environment";
const OPERATION_ENVIRONMENT_BUILD = "environment.build";
const OPERATION_ENVIRONMENT_SETUP = "environment.setup";
const OPERATION_ENVIRONMENT_PROOF = "environment.proof";

const ATTRIBUTE_PHASE = "kanthord.phase";
const ATTRIBUTE_TASK_ID = "kanthord.task.id";
const ATTRIBUTE_VERIFICATION_INDEX = "kanthord.verification.index";
const ATTRIBUTE_GIT_STEP = "kanthord.git.step";
const ATTRIBUTE_AGENT_NAME = "kanthord.agent.name";
const ATTRIBUTE_TURN_INDEX = "kanthord.turn.index";
const ATTRIBUTE_TOOL_NAME = "gen_ai.tool.name";
const ATTRIBUTE_STATE_FROM = "kanthord.node.state.from";
const ATTRIBUTE_STATE_TO = "kanthord.node.state.to";
const ATTRIBUTE_TRANSITION_RULE = "kanthord.transition.rule";
const ATTRIBUTE_TRANSITION_COUNT = "kanthord.transition.count";
const ATTRIBUTE_TRANSITION_LIMIT = "kanthord.transition.limit";
const ATTRIBUTE_EXECUTION_KIND = "kanthord.execution.kind";
const ATTRIBUTE_EXECUTION_END = "kanthord.execution.end";
const ATTRIBUTE_REVOKE_CAUSE = "kanthord.revoke.cause";
const ATTRIBUTE_BINDING_NAME = "project.binding.name";

const ACT_LABELS: Readonly<Record<ActOperation, string>> = {
  "mission.node.pause": "Paused",
  "mission.node.resume": "Resumed",
  "mission.node.ready": "Ready",
  "mission.node.block": "Blocked",
  "mission.node.unblock": "Unblocked",
  "mission.node.discard": "Discarded",
  "mission.node.override": "Overridden",
  "mission.proposal.approve": "Proposal approved",
  "mission.evidence.delete": "Evidence deleted",
};

const RULE_DETAILS: Readonly<Record<Exclude<TransitionRule, "none">, string>> = {
  failure_limit: "Paused at the failure limit",
  further_work_limit: "Paused at the further work limit",
  rework_limit: "Blocked at the rework limit",
};

const REVOCATION_DETAILS: Readonly<Record<RevokeCause, string>> = {
  assessment: "Revoked by a review",
  human: "Revoked by a human",
};

export type SpanGroup = "agent" | "tools" | "checks" | "git" | "other";

function valueText(value: SpanAttributeValue | undefined): string | null {
  if (value === undefined) return null;
  return String(value);
}

type SpanAttributes = TraceSpan["attributes"];

function withValue(title: string, attributes: SpanAttributes, attribute: string): string {
  const value = valueText(attributes[attribute]);
  return value === null ? title : `${title} ${value}`;
}

function transitionLabel(attributes: SpanAttributes): string {
  const from = valueText(attributes[ATTRIBUTE_STATE_FROM]);
  const to = valueText(attributes[ATTRIBUTE_STATE_TO]);
  if (from === null || to === null) return "Transition";
  return `Transition ${from} -> ${to}`;
}

function isAct(operation: string): operation is ActOperation {
  return Object.hasOwn(ACT_LABELS, operation);
}

export function operationLabel(operation: string, attributes: SpanAttributes): string {
  if (isAct(operation)) return ACT_LABELS[operation];
  switch (operation) {
    case OPERATION_TRANSITION:
      return transitionLabel(attributes);
    case OPERATION_EXECUTION:
      return "Execution";
    case OPERATION_PHASE:
      return withValue("Phase", attributes, ATTRIBUTE_PHASE);
    case OPERATION_TASK:
      return withValue("Task", attributes, ATTRIBUTE_TASK_ID);
    case OPERATION_VERIFICATION:
      return withValue("Verification", attributes, ATTRIBUTE_VERIFICATION_INDEX);
    case OPERATION_JUDGEMENT:
      return "Judgement";
    case OPERATION_EVALUATION:
      return "Evaluation";
    case OPERATION_GIT:
      return withValue("Git", attributes, ATTRIBUTE_GIT_STEP);
    case OPERATION_SESSION:
      return withValue("Session", attributes, ATTRIBUTE_AGENT_NAME);
    case OPERATION_TURN:
      return withValue("Turn", attributes, ATTRIBUTE_TURN_INDEX);
    case OPERATION_TOOL:
      return valueText(attributes[ATTRIBUTE_TOOL_NAME]) ?? operation;
    case OPERATION_PROGRESS:
      return "Progress";
    case OPERATION_ENVIRONMENT:
      return withValue("Environment", attributes, ATTRIBUTE_BINDING_NAME);
    case OPERATION_ENVIRONMENT_BUILD:
      return "Build";
    case OPERATION_ENVIRONMENT_SETUP:
      return "Setup";
    case OPERATION_ENVIRONMENT_PROOF:
      return "Proof";
    default:
      return operation;
  }
}

export function spanLabel(span: TraceSpan): string {
  return operationLabel(span.operation, span.attributes);
}

function transitionDetail(span: TraceSpan): string | null {
  const rule = valueText(span.attributes[ATTRIBUTE_TRANSITION_RULE]);
  if (rule === null || !Object.hasOwn(RULE_DETAILS, rule)) return null;
  const count = valueText(span.attributes[ATTRIBUTE_TRANSITION_COUNT]);
  const limit = valueText(span.attributes[ATTRIBUTE_TRANSITION_LIMIT]);
  const detail = RULE_DETAILS[rule as keyof typeof RULE_DETAILS];
  return count === null || limit === null ? detail : `${detail}: ${count} of ${limit}`;
}

function executionDetail(span: TraceSpan): string | null {
  const kind = valueText(span.attributes[ATTRIBUTE_EXECUTION_KIND]);
  const cause = valueText(span.attributes[ATTRIBUTE_REVOKE_CAUSE]);
  const revoked = valueText(span.attributes[ATTRIBUTE_EXECUTION_END]) === "revoked";
  const revocation =
    revoked && cause !== null && Object.hasOwn(REVOCATION_DETAILS, cause)
      ? REVOCATION_DETAILS[cause as RevokeCause]
      : null;
  const parts = [kind, revocation].filter((part) => part !== null);
  return parts.length === 0 ? null : parts.join(" - ");
}

export function spanDetail(span: TraceSpan): string | null {
  switch (span.operation) {
    case OPERATION_TRANSITION:
      return transitionDetail(span);
    case OPERATION_EXECUTION:
      return executionDetail(span);
    default:
      return null;
  }
}

export function spanGroup(span: TraceSpan): SpanGroup {
  switch (span.operation) {
    case OPERATION_SESSION:
    case OPERATION_TURN:
    case OPERATION_PROGRESS:
      return "agent";
    case OPERATION_TOOL:
      return "tools";
    case OPERATION_VERIFICATION:
    case OPERATION_JUDGEMENT:
    case OPERATION_EVALUATION:
      return "checks";
    case OPERATION_GIT:
      return "git";
    default:
      return "other";
  }
}
