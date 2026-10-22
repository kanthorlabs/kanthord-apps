import type { SpanAttributeValue, TraceSpan } from "@/api/types";

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

const ATTRIBUTE_PHASE = "kanthord.phase";
const ATTRIBUTE_TASK_ID = "kanthord.task.id";
const ATTRIBUTE_VERIFICATION_INDEX = "kanthord.verification.index";
const ATTRIBUTE_GIT_STEP = "kanthord.git.step";
const ATTRIBUTE_AGENT_NAME = "kanthord.agent.name";
const ATTRIBUTE_TURN_INDEX = "kanthord.turn.index";
const ATTRIBUTE_TOOL_NAME = "gen_ai.tool.name";

export type SpanGroup = "agent" | "tools" | "checks" | "git" | "other";

function valueText(value: SpanAttributeValue | undefined): string | null {
  if (value === undefined) return null;
  return String(value);
}

function withValue(title: string, span: TraceSpan, attribute: string): string {
  const value = valueText(span.attributes[attribute]);
  return value === null ? title : `${title} ${value}`;
}

export function spanLabel(span: TraceSpan): string {
  switch (span.operation) {
    case OPERATION_EXECUTION:
      return "Execution";
    case OPERATION_PHASE:
      return withValue("Phase", span, ATTRIBUTE_PHASE);
    case OPERATION_TASK:
      return withValue("Task", span, ATTRIBUTE_TASK_ID);
    case OPERATION_VERIFICATION:
      return withValue("Verification", span, ATTRIBUTE_VERIFICATION_INDEX);
    case OPERATION_JUDGEMENT:
      return "Judgement";
    case OPERATION_EVALUATION:
      return "Evaluation";
    case OPERATION_GIT:
      return withValue("Git", span, ATTRIBUTE_GIT_STEP);
    case OPERATION_SESSION:
      return withValue("Session", span, ATTRIBUTE_AGENT_NAME);
    case OPERATION_TURN:
      return withValue("Turn", span, ATTRIBUTE_TURN_INDEX);
    case OPERATION_TOOL:
      return valueText(span.attributes[ATTRIBUTE_TOOL_NAME]) ?? span.operation;
    case OPERATION_PROGRESS:
      return "Progress";
    default:
      return span.operation;
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
