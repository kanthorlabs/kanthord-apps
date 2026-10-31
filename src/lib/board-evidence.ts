import type {
  EffectiveCause,
  EnvironmentState,
  MissionEvidence,
  SchedulerExecutionRecord,
  TraceSpan,
  WorkbenchPendingApproval,
} from "@/api/types";

import type { AttentionItem, DetailRead, OutsideAttentionItem } from "./attention";
import { endLabel, endTimeOf } from "./execution-stop";
import type { EnvironmentFailedItem } from "./fix-attention";
import type { ToolApprovalItem } from "./approval-attention";

export interface TraceCause {
  readonly traceId: string;
  readonly cause: EffectiveCause | null;
}

export interface DiscardReason {
  readonly id: string;
  readonly reason: string | null;
}

export interface BoardReads {
  readonly session: DetailRead<WorkbenchPendingApproval | null> | null;
  readonly discard: DetailRead<readonly DiscardReason[]> | null;
  readonly evidence: DetailRead<readonly MissionEvidence[]> | null;
  readonly transition: DetailRead<readonly TraceSpan[]> | null;
  readonly cause: DetailRead<TraceCause | null> | null;
}

export interface EvidenceReads extends BoardReads {
  readonly executions: readonly SchedulerExecutionRecord[];
}

export interface EvidenceLink {
  readonly label: string;
  readonly to: string;
}

export interface EvidenceLine {
  readonly key: string;
  readonly kind: "text" | "log" | "command";
  readonly text: string;
  readonly links: readonly EvidenceLink[];
  readonly command: string | null;
}

export interface FailureCount {
  readonly count: number;
  readonly limit: number;
}

export interface BoardEvidence {
  readonly lines: readonly EvidenceLine[];
  readonly failures: FailureCount | null;
}

const COMMIT_LENGTH = 12;
const CLOCK_START = 11;
const CLOCK_END = 16;
const OPERATION_TRANSITION = "scheduler.transition";
const ATTRIBUTE_RULE = "kanthord.transition.rule";
const ATTRIBUTE_COUNT = "kanthord.transition.count";
const ATTRIBUTE_LIMIT = "kanthord.transition.limit";
const RULE_FAILURE_LIMIT = "failure_limit";
const GITHUB_IDENTITY = /^repository:github:(.+)$/;

function textLine(key: string, text: string, links: readonly EvidenceLink[] = []): EvidenceLine {
  return { key, kind: "text", text, links, command: null };
}

function tracePathOf(traceId: string): string {
  return `/traces/${encodeURIComponent(traceId)}`;
}

function clockOf(ms: number): string {
  return new Date(ms).toISOString().slice(CLOCK_START, CLOCK_END);
}

function agentsOf(execution: SchedulerExecutionRecord): string {
  const names = [...new Set(execution.agent_selections.map((selection) => selection.agent_name))];
  return names.length === 0 ? "no agent" : names.join(", ");
}

function executionLineOf(execution: SchedulerExecutionRecord, kind: string): EvidenceLine {
  const ended = endTimeOf(execution);
  const end = ended === null ? "now" : clockOf(ended);
  return textLine(
    `execution:${execution.execution_id}`,
    `${kind} ${clockOf(execution.created_at)} to ${end} UTC · ${agentsOf(execution)} · ${endLabel(execution)}`,
    [{ label: execution.execution_id, to: tracePathOf(execution.trace_id) }],
  );
}

function executionLinesOf(
  item: Extract<AttentionItem, { kind: "paused" }>,
  executions: readonly SchedulerExecutionRecord[],
): readonly EvidenceLine[] {
  return executions
    .filter((execution) => execution.attempt === item.node.attempt)
    .sort((left, right) => left.created_at - right.created_at)
    .map((execution) => executionLineOf(execution, item.node.intent));
}

function resultTextOf(result: {
  readonly command: string;
  readonly exit_code: number | null;
  readonly signal: string | null;
  readonly timed_out: boolean;
}): string {
  const { command, exit_code: exitCode, signal, timed_out: timedOut } = result;
  if (timedOut) return `✗ ${command} · timed out`;
  if (signal !== null) return `✗ ${command} · signal ${signal}`;
  if (exitCode === 0) return `✓ ${command} · exit 0`;
  if (exitCode === null) return `✗ ${command} · no exit code`;
  return `✗ ${command} · exit ${exitCode}`;
}

function bindingNameOf(
  bindingId: string,
  environments: readonly EnvironmentState[] | null,
): string {
  const state = environments?.find((candidate) => candidate.binding_id === bindingId);
  return state?.binding_name ?? bindingId.slice(0, COMMIT_LENGTH);
}

function recordLinesOf(
  record: MissionEvidence,
  environments: readonly EnvironmentState[] | null,
): readonly EvidenceLine[] {
  const commits = record.assets.flatMap((asset): readonly EvidenceLine[] =>
    asset.kind === "repository"
      ? [
          textLine(
            `${record.id}:commit:${asset.id}`,
            `commit ${asset.address.commit.slice(0, COMMIT_LENGTH)} on binding ${bindingNameOf(asset.address.binding_id, environments)}`,
          ),
        ]
      : [],
  );
  const results = (record.verification?.results ?? []).map((result, index) =>
    textLine(`${record.id}:result:${index}`, resultTextOf(result)),
  );
  return [textLine(`${record.id}:subject`, record.subject), ...commits, ...results];
}

function blockedLinesOf(
  reads: EvidenceReads,
  environments: readonly EnvironmentState[] | null,
): readonly EvidenceLine[] {
  const records = reads.evidence?.status === "ready" ? reads.evidence.data : [];
  const trace = reads.cause?.status === "ready" ? reads.cause.data : null;
  return [
    ...records.flatMap((record) => recordLinesOf(record, environments)),
    ...(trace === null
      ? []
      : [textLine("trace", "trace", [{ label: trace.traceId, to: tracePathOf(trace.traceId) }])]),
  ];
}

function requestLinesOf(item: OutsideAttentionItem): readonly EvidenceLine[] {
  for (const asset of item.request.evidence?.assets ?? []) {
    if (asset.kind !== "platform" || asset.address.kind !== "pull_request") continue;
    const github = GITHUB_IDENTITY.exec(asset.address.resource_identity);
    const label =
      github?.[1] === undefined ? asset.address.resource_identity : `github.com/${github[1]}`;
    return [textLine("request", `pull request #${asset.address.number} · ${label}`)];
  }
  return [];
}

function environmentLinesOf(item: EnvironmentFailedItem): readonly EvidenceLine[] {
  const { failure } = item;
  if (failure === null) return [];
  const result = failure.exit_code === null ? "did not finish" : `exit ${failure.exit_code}`;
  return [
    textLine("failure", `${failure.command} · ${result}`),
    ...(failure.tail === ""
      ? []
      : [{ key: "tail", kind: "log" as const, text: failure.tail, links: [], command: null }]),
    {
      key: "reproduce",
      kind: "command" as const,
      text: "Reproduce:",
      links: [],
      command: failure.reproduce,
    },
  ];
}

function sessionLinesOf(item: ToolApprovalItem): readonly EvidenceLine[] {
  return [textLine("session", `session ${item.sessionId} · operation ${item.operationId}`)];
}

function linesOf(
  item: AttentionItem,
  reads: EvidenceReads,
  environments: readonly EnvironmentState[] | null,
): readonly EvidenceLine[] {
  switch (item.kind) {
    case "paused":
      return executionLinesOf(item, reads.executions);
    case "blocked":
      return blockedLinesOf(reads, environments);
    case "merge_wait":
    case "delivery_unconfirmed":
      return requestLinesOf(item);
    case "environment_failed":
      return environmentLinesOf(item);
    case "tool_approval":
      return sessionLinesOf(item);
    default:
      return [];
  }
}

function failuresOf(transition: EvidenceReads["transition"]): FailureCount | null {
  if (transition?.status !== "ready") return null;
  const span = transition.data.find(
    (candidate) =>
      candidate.operation === OPERATION_TRANSITION &&
      candidate.attributes[ATTRIBUTE_RULE] === RULE_FAILURE_LIMIT,
  );
  const count = span?.attributes[ATTRIBUTE_COUNT];
  const limit = span?.attributes[ATTRIBUTE_LIMIT];
  return typeof count === "number" && typeof limit === "number" ? { count, limit } : null;
}

export function evidenceOf(
  item: AttentionItem,
  reads: EvidenceReads,
  environments: readonly EnvironmentState[] | null,
): BoardEvidence {
  return { lines: linesOf(item, reads, environments), failures: failuresOf(reads.transition) };
}
