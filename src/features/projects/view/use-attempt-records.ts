import {
  listNodeAssessments,
  listNodeEvidence,
  listNodeExternalActions,
  listNodeFindings,
  listNodeOutcomes,
  readNodeRevision,
} from "@/api/resources/mission";
import { listNodeExecutions } from "@/api/resources/scheduler";
import type {
  MissionAssessment,
  MissionAttempt,
  MissionEvidence,
  MissionExternalAction,
  MissionFinding,
  MissionOutcome,
  MissionRevision,
  SchedulerExecutionRecord,
} from "@/api/types";
import { type Resource, useResource } from "@/hooks/use-resource";
import { type BindingReads, readBindings, settle, type SettledRead } from "./settled-read";

export interface AttemptRecords {
  readonly revision: SettledRead<MissionRevision>;
  readonly executions: SettledRead<readonly SchedulerExecutionRecord[]>;
  readonly evidence: SettledRead<readonly MissionEvidence[]>;
  readonly assessments: SettledRead<readonly MissionAssessment[]>;
  readonly outcomes: SettledRead<readonly MissionOutcome[]>;
  readonly externalActions: SettledRead<readonly MissionExternalAction[]>;
  readonly findings: SettledRead<readonly MissionFinding[]>;
  readonly bindings: BindingReads;
}

async function readAttemptRecords(
  projectId: string,
  attempt: MissionAttempt,
): Promise<AttemptRecords> {
  const { node_id: nodeId } = attempt;
  const [revision, executions, evidence, assessments, outcomes, externalActions, findings] =
    await Promise.all([
      settle(readNodeRevision(nodeId, attempt.node_revision)),
      settle(listNodeExecutions(projectId, nodeId, attempt.attempt)),
      settle(listNodeEvidence(nodeId, attempt.attempt)),
      settle(listNodeAssessments(nodeId, attempt.attempt)),
      settle(listNodeOutcomes(nodeId, attempt.attempt)),
      settle(listNodeExternalActions(nodeId, attempt.attempt)),
      settle(listNodeFindings(nodeId, attempt.attempt)),
    ]);
  const bindingIds = [
    ...(revision.data?.content.bindings ?? []),
    ...attempt.required_external_actions.map((action) => action.binding_id),
  ];
  const bindings = await readBindings(projectId, bindingIds);
  return {
    revision,
    executions,
    evidence,
    assessments,
    outcomes,
    externalActions,
    findings,
    bindings,
  };
}

export function useAttemptRecords(
  projectId: string,
  attempt: MissionAttempt,
  refreshKey: number,
): Resource<AttemptRecords> {
  return useResource(
    () => readAttemptRecords(projectId, attempt),
    [projectId, attempt.node_id, attempt.attempt, refreshKey],
  );
}
