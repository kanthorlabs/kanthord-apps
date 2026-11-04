import type {
  CleanableKind,
  CleanupRule,
  FootprintCandidate,
  FootprintCleanupCreateBody,
  WorkerPlacement,
} from "@/api/types";
import { counted } from "@/lib/counted";
import { byteText } from "@/lib/format";
import {
  cleanupTimingText,
  CONSEQUENCE_TEXTS,
  FOOTPRINT_CLEANUP_KEYS_MAX,
  FOOTPRINT_DEFAULT_AGE_DAYS,
  HAND_PICK_SAFER_TEXT,
  itemNoun,
  OLDER_THAN_SAFER_TEXT,
  PRESET_CONSEQUENCE_TEXT,
  WORKSPACE_LOSS_TEXT,
} from "@/lib/footprint";

export interface CleanupPlan {
  readonly title: string;
  readonly sentences: readonly string[];
  readonly saferPath: string;
  readonly actionLabel: string;
  readonly calls: readonly FootprintCleanupCreateBody[];
}

export interface SelectionPlanInput {
  readonly kind: CleanableKind;
  readonly instanceName: string | null;
  readonly placement: WorkerPlacement | null;
  readonly rule: CleanupRule | null;
  readonly keys: readonly string[];
  readonly bytes: number | null;
  readonly estimated: boolean;
}

export interface PresetHost {
  readonly instanceName: string;
  readonly placement: WorkerPlacement | null;
  readonly candidates: readonly FootprintCandidate[];
}

const PRESET_RULE: CleanupRule = {
  name: "older_than",
  older_than_days: FOOTPRINT_DEFAULT_AGE_DAYS,
};

function hostText(instanceName: string | null): string {
  return instanceName === null ? "the server" : instanceName;
}

function sizeText(bytes: number | null, estimated: boolean): string {
  if (bytes === null) return "";
  return `, ${estimated ? "about " : ""}${byteText(bytes)}`;
}

function nouns(kind: CleanableKind, count: number): string {
  return `${count} ${itemNoun(kind, count)}`;
}

export function isSelectable(candidate: FootprintCandidate): boolean {
  return candidate.refusal === null && !candidate.kept;
}

export function oversizedCall(plan: CleanupPlan): FootprintCleanupCreateBody | null {
  return plan.calls.find((call) => call.keys.length > FOOTPRINT_CLEANUP_KEYS_MAX) ?? null;
}

export function selectionPlan(input: SelectionPlanInput): CleanupPlan {
  const count = input.keys.length;
  const sentences = [
    `This deletes ${nouns(input.kind, count)} on ${hostText(input.instanceName)}${sizeText(input.bytes, input.estimated)}.`,
    CONSEQUENCE_TEXTS[input.kind],
  ];
  if (input.kind === "workspace") sentences.push(WORKSPACE_LOSS_TEXT);
  const timing = cleanupTimingText(input.kind, input.placement);
  if (timing !== null) sentences.push(timing);
  return {
    title: `Delete ${nouns(input.kind, count)}?`,
    sentences,
    saferPath: input.rule?.name === "older_than" ? OLDER_THAN_SAFER_TEXT : HAND_PICK_SAFER_TEXT,
    actionLabel: `Delete ${counted(count, "item", "items")}`,
    calls: [
      {
        kind: input.kind,
        instance_name: input.instanceName,
        rule: input.rule,
        keys: input.keys,
      },
    ],
  };
}

export function presetPlan(
  traces: readonly FootprintCandidate[],
  hosts: readonly PresetHost[],
): CleanupPlan | null {
  const traceExecutions = new Set(
    traces
      .filter(isSelectable)
      .map((trace) => trace.execution_id)
      .filter((id): id is string => id !== null),
  );
  const sessionCalls = hosts
    .map((host) => ({
      host,
      keys: host.candidates
        .filter((candidate) => isSelectable(candidate) && traceExecutions.has(candidate.key))
        .map((candidate) => candidate.key),
    }))
    .filter((entry) => entry.keys.length > 0);
  const executions = new Set(sessionCalls.flatMap((entry) => entry.keys));
  const traceKeys = traces
    .filter(
      (trace) =>
        isSelectable(trace) && trace.execution_id !== null && executions.has(trace.execution_id),
    )
    .map((trace) => trace.key);
  if (traceKeys.length === 0) return null;
  const sessionCount = sessionCalls.reduce((sum, entry) => sum + entry.keys.length, 0);
  const timings = sessionCalls.flatMap((entry) => {
    const timing = cleanupTimingText("session", entry.host.placement);
    return timing === null ? [] : [`${entry.host.instanceName}: ${timing}`];
  });
  const hostNames = sessionCalls.map((entry) => entry.host.instanceName).join(", ");
  return {
    title: `Delete ${counted(executions.size, "execution", "executions")}?`,
    sentences: [
      `This deletes ${nouns("trace", traceKeys.length)} on the server and ${nouns("session", sessionCount)} on ${hostNames}.`,
      PRESET_CONSEQUENCE_TEXT,
      ...timings,
    ],
    saferPath: OLDER_THAN_SAFER_TEXT,
    actionLabel: `Delete ${counted(traceKeys.length + sessionCount, "item", "items")}`,
    calls: [
      { kind: "trace", instance_name: null, rule: PRESET_RULE, keys: traceKeys },
      ...sessionCalls.map((entry) => ({
        kind: "session" as const,
        instance_name: entry.host.instanceName,
        rule: PRESET_RULE,
        keys: entry.keys,
      })),
    ],
  };
}
