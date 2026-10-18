import {
  listNodeAssessments,
  listNodeEvidence,
  listNodeExternalActions,
  listNodeProposals,
} from "@/api/resources/mission";
import { listNodeExecutions } from "@/api/resources/scheduler";
import type { MissionAssessment, MissionProposal } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";
import {
  detailKeyOf,
  type AttentionDetail,
  type BlockedDetail,
  type DetailRead,
  type DetailTarget,
  type ExternalDetail,
  type OpenDetail,
  type PausedDetail,
} from "@/lib/attention";

async function settle<T>(read: Promise<T>): Promise<DetailRead<T>> {
  try {
    return { status: "ready", data: await read };
  } catch (cause: unknown) {
    return { status: "failed", message: asApiError(cause).message };
  }
}

async function readAssessment(target: DetailTarget): Promise<MissionAssessment | null> {
  const outcome = target.node.blocked_context?.outcome;
  if (outcome === undefined) return null;
  const assessments = await listNodeAssessments(target.node.id, outcome.attempt);
  return assessments.find((assessment) => assessment.id === outcome.assessment_id) ?? null;
}

async function readProposals(target: DetailTarget): Promise<readonly MissionProposal[]> {
  return target.node.intent === "examine" ? listNodeProposals(target.node.id) : [];
}

async function readBlocked(target: DetailTarget): Promise<BlockedDetail> {
  const [assessment, proposals] = await Promise.all([
    settle(readAssessment(target)),
    settle(readProposals(target)),
  ]);
  return { kind: "blocked", key: detailKeyOf(target.node), assessment, proposals };
}

async function readPaused(target: DetailTarget): Promise<PausedDetail> {
  const { node, projectId } = target;
  const [executions, actions] = await Promise.all([
    settle(
      node.attempt === 0
        ? Promise.resolve([])
        : listNodeExecutions(projectId, node.id, node.attempt),
    ),
    settle(
      node.attempt === 0 ? Promise.resolve([]) : listNodeExternalActions(node.id, node.attempt),
    ),
  ]);
  return { kind: "paused", key: detailKeyOf(node), executions, actions };
}

async function readOpen(target: DetailTarget): Promise<OpenDetail> {
  const { node } = target;
  return {
    kind: "open",
    key: detailKeyOf(node),
    actions: await settle(listNodeExternalActions(node.id, node.attempt)),
  };
}

async function readExternal(target: DetailTarget): Promise<ExternalDetail> {
  const { node } = target;
  const [actions, evidence] = await Promise.all([
    settle(listNodeExternalActions(node.id, node.attempt)),
    settle(listNodeEvidence(node.id, node.attempt)),
  ]);
  return { kind: "external", key: detailKeyOf(node), actions, evidence, refreshFault: null };
}

export async function readAttentionDetail(target: DetailTarget): Promise<AttentionDetail> {
  if (target.kind === "blocked") return readBlocked(target);
  if (target.kind === "paused") return readPaused(target);
  return target.kind === "open" ? readOpen(target) : readExternal(target);
}
