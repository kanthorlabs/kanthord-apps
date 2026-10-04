import { newUlid } from "@/lib/ulid";
import { request } from "../client";
import { readAllPages } from "../pages";
import type {
  Mission,
  MissionImportApply,
  MissionImportPreview,
  MissionImportResult,
  MissionImportSnapshot,
  MissionJsonExport,
  MissionAssessment,
  MissionAttempt,
  MissionEdge,
  MissionEvidence,
  MissionExternalAction,
  MissionNodeRecord,
  MissionOutcome,
  MissionRevision,
} from "../types";

export async function readMission(projectId: string): Promise<Mission> {
  return request<Mission>(`/api/mission/project/${encodeURIComponent(projectId)}`);
}

export async function exportMissionJson(missionId: string): Promise<MissionJsonExport> {
  return request<MissionJsonExport>(
    `/api/mission/${encodeURIComponent(missionId)}/export?format=json`,
  );
}

export async function previewMissionImport(
  snapshot: MissionImportSnapshot,
): Promise<MissionImportPreview> {
  return request<MissionImportPreview>(
    `/api/mission/${encodeURIComponent(snapshot.missionId)}/import/preview`,
    { method: "POST", body: snapshot },
  );
}

export async function applyMissionImport(body: MissionImportApply): Promise<MissionImportResult> {
  return request<MissionImportResult>(`/api/mission/${encodeURIComponent(body.missionId)}/import`, {
    method: "POST",
    body,
    headers: { "idempotency-key": newUlid() },
  });
}

export async function listMissionNodes(missionId: string): Promise<readonly MissionNodeRecord[]> {
  return readAllPages<MissionNodeRecord>(`/api/mission/${encodeURIComponent(missionId)}/node`);
}

export async function listMissionDependencies(missionId: string): Promise<readonly MissionEdge[]> {
  return readAllPages<MissionEdge>(`/api/mission/${encodeURIComponent(missionId)}/edge`, {
    kind: "dependency",
  });
}

export async function readMissionNode(nodeId: string): Promise<MissionNodeRecord> {
  return request<MissionNodeRecord>(`/api/mission/node/${encodeURIComponent(nodeId)}`);
}

export async function listNodeRevisions(nodeId: string): Promise<readonly MissionRevision[]> {
  return readAllPages<MissionRevision>(`/api/mission/node/${encodeURIComponent(nodeId)}/revision`);
}

export async function readNodeRevision(nodeId: string, revision: number): Promise<MissionRevision> {
  return request<MissionRevision>(
    `/api/mission/node/${encodeURIComponent(nodeId)}/revision/${revision}`,
  );
}

export async function listNodeAttempts(nodeId: string): Promise<readonly MissionAttempt[]> {
  return readAllPages<MissionAttempt>(`/api/mission/node/${encodeURIComponent(nodeId)}/attempt`);
}

export async function listNodeEvidence(
  nodeId: string,
  attempt: number,
): Promise<readonly MissionEvidence[]> {
  return readAllPages<MissionEvidence>(`/api/mission/node/${encodeURIComponent(nodeId)}/evidence`, {
    attempt: String(attempt),
  });
}

export async function listNodeAssessments(
  nodeId: string,
  attempt: number,
): Promise<readonly MissionAssessment[]> {
  return readAllPages<MissionAssessment>(
    `/api/mission/node/${encodeURIComponent(nodeId)}/assessment`,
    { attempt: String(attempt) },
  );
}

export async function listNodeOutcomes(
  nodeId: string,
  attempt: number,
): Promise<readonly MissionOutcome[]> {
  return readAllPages<MissionOutcome>(`/api/mission/node/${encodeURIComponent(nodeId)}/outcome`, {
    attempt: String(attempt),
  });
}

export async function listNodeExternalActions(
  nodeId: string,
  attempt: number,
): Promise<readonly MissionExternalAction[]> {
  return readAllPages<MissionExternalAction>(
    `/api/mission/node/${encodeURIComponent(nodeId)}/external-action`,
    { attempt: String(attempt) },
  );
}
