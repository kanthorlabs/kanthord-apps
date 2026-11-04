import { newIdempotencyKey } from "@/lib/idempotency-key";
import { request } from "../client";
import { readAllPages } from "../pages";
import type {
  CleanableKind,
  FootprintAlert,
  FootprintCandidate,
  FootprintCandidatePage,
  FootprintCandidateQuery,
  FootprintCleanupCreateBody,
  FootprintCleanupRecord,
  FootprintKind,
  FootprintKindRead,
  FootprintStat,
  FootprintSummary,
  Page,
} from "../types";

const FOOTPRINT_PATH = "/api/footprint";
const CLEANUP_PATH = `${FOOTPRINT_PATH}/cleanup`;
const ALERT_PATH = `${FOOTPRINT_PATH}/alert`;

function kindPath(kind: string): string {
  return `${FOOTPRINT_PATH}/kind/${encodeURIComponent(kind)}`;
}

function cleanupPath(cleanupId: string): string {
  return `${CLEANUP_PATH}/${encodeURIComponent(cleanupId)}`;
}

function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body,
    headers: { "idempotency-key": newIdempotencyKey() },
  });
}

function withQuery(path: string, params: URLSearchParams): string {
  const text = params.toString();
  return text === "" ? path : `${path}?${text}`;
}

function candidateParams(query: FootprintCandidateQuery): Record<string, string> {
  const params: Record<string, string> = { rule: query.rule.name };
  if (query.instance_name !== null) params["instance_name"] = query.instance_name;
  if (query.rule.name === "older_than") {
    params["older_than_days"] = String(query.rule.older_than_days);
  }
  return params;
}

function pageParams(
  base: Readonly<Record<string, string>>,
  cursor: string | null,
  limit: number,
): URLSearchParams {
  const params = new URLSearchParams({ ...base, limit: String(limit) });
  if (cursor !== null) params.set("cursor", cursor);
  return params;
}

function instanceParams(instanceName: string | null): Record<string, string> {
  return instanceName === null ? {} : { instance_name: instanceName };
}

export async function readFootprintSummary(): Promise<FootprintSummary> {
  return request<FootprintSummary>(FOOTPRINT_PATH);
}

export async function readFootprintKind(
  kind: FootprintKind,
  instanceName: string | null = null,
): Promise<FootprintKindRead> {
  return request<FootprintKindRead>(
    withQuery(kindPath(kind), new URLSearchParams(instanceParams(instanceName))),
  );
}

export async function listFootprintCandidatePage(
  kind: CleanableKind,
  query: FootprintCandidateQuery,
  cursor: string | null,
  limit: number,
): Promise<FootprintCandidatePage> {
  return request<FootprintCandidatePage>(
    withQuery(`${kindPath(kind)}/candidate`, pageParams(candidateParams(query), cursor, limit)),
  );
}

export async function listAllFootprintCandidates(
  kind: CleanableKind,
  query: FootprintCandidateQuery,
): Promise<readonly FootprintCandidate[]> {
  return readAllPages<FootprintCandidate>(`${kindPath(kind)}/candidate`, candidateParams(query));
}

export async function listFootprintItemPage(
  kind: CleanableKind,
  instanceName: string | null,
  cursor: string | null,
  limit: number,
): Promise<Page<FootprintCandidate>> {
  return request<Page<FootprintCandidate>>(
    withQuery(`${kindPath(kind)}/item`, pageParams(instanceParams(instanceName), cursor, limit)),
  );
}

export async function listAllFootprintItems(
  kind: CleanableKind,
  instanceName: string | null,
): Promise<readonly FootprintCandidate[]> {
  return readAllPages<FootprintCandidate>(`${kindPath(kind)}/item`, instanceParams(instanceName));
}

export async function createFootprintCleanup(
  body: FootprintCleanupCreateBody,
): Promise<FootprintCleanupRecord> {
  return post<FootprintCleanupRecord>(CLEANUP_PATH, body);
}

export async function readFootprintCleanup(cleanupId: string): Promise<FootprintCleanupRecord> {
  return request<FootprintCleanupRecord>(cleanupPath(cleanupId));
}

export async function listFootprintCleanupPage(
  kind: CleanableKind | null,
  cursor: string | null,
  limit: number,
): Promise<Page<FootprintCleanupRecord>> {
  return request<Page<FootprintCleanupRecord>>(
    withQuery(CLEANUP_PATH, pageParams(kind === null ? {} : { kind }, cursor, limit)),
  );
}

export async function cancelFootprintCleanup(cleanupId: string): Promise<FootprintCleanupRecord> {
  return post<FootprintCleanupRecord>(`${cleanupPath(cleanupId)}/cancel`);
}

export async function listFootprintAlertPage(
  open: boolean | null,
  cursor: string | null,
  limit: number,
): Promise<Page<FootprintAlert>> {
  return request<Page<FootprintAlert>>(
    withQuery(ALERT_PATH, pageParams(open === null ? {} : { open: String(open) }, cursor, limit)),
  );
}

export async function acknowledgeFootprintAlert(alertId: string): Promise<FootprintAlert> {
  return post<FootprintAlert>(`${ALERT_PATH}/${encodeURIComponent(alertId)}/acknowledge`);
}

export async function runFootprintMeasure(): Promise<readonly FootprintStat[]> {
  const answer = await post<{ stats: readonly FootprintStat[] }>(`${FOOTPRINT_PATH}/measure`);
  return answer.stats;
}
