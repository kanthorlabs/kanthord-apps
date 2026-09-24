import { request } from "../client";
import type {
  Attempt,
  BlockedNode,
  DependencyClosure,
  MissionNode,
  NodeRevision,
  UnblockRecord,
} from "../types";

export async function listNodes(projectId: string): Promise<readonly MissionNode[]> {
  return request<readonly MissionNode[]>(`/v1/projects/${projectId}/mission/nodes`);
}

export async function readNode(projectId: string, nodeId: string): Promise<MissionNode> {
  return request<MissionNode>(`/v1/projects/${projectId}/mission/nodes/${nodeId}`);
}

export async function listRevisions(
  projectId: string,
  nodeId: string,
): Promise<readonly NodeRevision[]> {
  return request<readonly NodeRevision[]>(
    `/v1/projects/${projectId}/mission/nodes/${nodeId}/revisions`,
  );
}

export async function listAttempts(projectId: string, nodeId: string): Promise<readonly Attempt[]> {
  return request<readonly Attempt[]>(`/v1/projects/${projectId}/mission/nodes/${nodeId}/attempts`);
}

export async function readClosure(projectId: string, nodeId: string): Promise<DependencyClosure> {
  return request<DependencyClosure>(`/v1/projects/${projectId}/mission/nodes/${nodeId}/closure`);
}

export async function listBlocked(projectId: string): Promise<readonly BlockedNode[]> {
  return request<readonly BlockedNode[]>(`/v1/projects/${projectId}/mission/blocked`);
}

export async function pause(projectId: string, nodeId: string): Promise<MissionNode> {
  return request<MissionNode>(`/v1/projects/${projectId}/mission/nodes/${nodeId}/pause`, {
    method: "POST",
  });
}

export async function resume(projectId: string, nodeId: string): Promise<MissionNode> {
  return request<MissionNode>(`/v1/projects/${projectId}/mission/nodes/${nodeId}/resume`, {
    method: "POST",
  });
}

/** A human blocks a paused node, and that path is the only human block. */
export async function block(
  projectId: string,
  nodeId: string,
  reason: string,
): Promise<MissionNode> {
  return request<MissionNode>(`/v1/projects/${projectId}/mission/nodes/${nodeId}/block`, {
    method: "POST",
    body: { reason },
  });
}

export async function unblock(
  projectId: string,
  nodeId: string,
  input: {
    readonly clearedAttemptId: string;
    readonly expectedRevisionId: string;
    readonly requestIdentifier: string;
    readonly contentChange?: { readonly goal?: string; readonly steps?: readonly string[] };
  },
): Promise<UnblockRecord> {
  return request<UnblockRecord>(`/v1/projects/${projectId}/mission/nodes/${nodeId}/unblock`, {
    method: "POST",
    body: input,
  });
}

/** Writes a successful outcome whose basis is a human assertion. Terminal. */
export async function overrideSuccess(
  projectId: string,
  nodeId: string,
  input: { readonly reason: string; readonly landedCommitId?: string },
): Promise<MissionNode> {
  return request<MissionNode>(`/v1/projects/${projectId}/mission/nodes/${nodeId}/override`, {
    method: "POST",
    body: input,
  });
}

/** Writes an outcome whose asserted result is that nothing is established. Terminal. */
export async function discard(
  projectId: string,
  nodeId: string,
  stoppingReason: string,
): Promise<MissionNode> {
  return request<MissionNode>(`/v1/projects/${projectId}/mission/nodes/${nodeId}/discard`, {
    method: "POST",
    body: { stoppingReason },
  });
}

export async function setPriority(
  projectId: string,
  nodeId: string,
  priority: number,
): Promise<MissionNode> {
  return request<MissionNode>(`/v1/projects/${projectId}/mission/nodes/${nodeId}/priority`, {
    method: "PUT",
    body: { priority },
  });
}
