import {
  listNodeAssessments,
  listNodeEvidence,
  listNodeExternalActions,
  listNodeOutcomes,
  readNodeRevision,
} from "@/api/resources/mission";
import { listNodeExecutions } from "@/api/resources/scheduler";
import type {
  MissionAssessment,
  MissionAttempt,
  MissionEvidence,
  MissionExternalAction,
  MissionOutcome,
  MissionRevision,
  SchedulerExecutionRecord,
} from "@/api/types";
import { useResource, type Resource } from "@/hooks/use-resource";
import { readBindings, settle, type BindingReads, type SettledRead } from "./settled-read";

export interface AttemptRecords {
  readonly revision: SettledRead<MissionRevision>;
  readonly executions: SettledRead<readonly SchedulerExecutionRecord[]>;
  readonly evidence: SettledRead<readonly MissionEvidence[]>;
  readonly assessments: SettledRead<readonly MissionAssessment[]>;
  readonly outcomes: SettledRead<readonly MissionOutcome[]>;
  readonly externalActions: SettledRead<readonly MissionExternalAction[]>;
  readonly bindings: BindingReads;
}

async function readAttemptRecords(
  projectId: string,
  attempt: MissionAttempt,
): Promise<AttemptRecords> {
  const { nodeId } = attempt;
  const [revision, executions, evidence, assessments, outcomes, externalActions] =
    await Promise.all([
      settle(readNodeRevision(nodeId, attempt.nodeRevision)),
      settle(listNodeExecutions(projectId, nodeId, attempt.attempt)),
      settle(listNodeEvidence(nodeId, attempt.attempt)),
      settle(listNodeAssessments(nodeId, attempt.attempt)),
      settle(listNodeOutcomes(nodeId, attempt.attempt)),
      settle(listNodeExternalActions(nodeId, attempt.attempt)),
    ]);
  const bindingIds = [
    ...(revision.data?.content.bindings ?? []),
    ...attempt.requiredExternalActions.map((action) => action.bindingId),
  ];
  const bindings = await readBindings(projectId, bindingIds);
  return { revision, executions, evidence, assessments, outcomes, externalActions, bindings };
}

export function useAttemptRecords(
  projectId: string,
  attempt: MissionAttempt,
): Resource<AttemptRecords> {
  return useResource(
    () => readAttemptRecords(projectId, attempt),
    [projectId, attempt.nodeId, attempt.attempt],
  );
}
