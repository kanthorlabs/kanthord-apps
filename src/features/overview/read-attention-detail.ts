import { listNodeAssessments, listNodeProposals } from "@/api/resources/mission";
import type { MissionAssessment, MissionProposal } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";
import {
  detailKeyOf,
  type AttentionDetail,
  type BlockedDetail,
  type DetailRead,
  type DetailTarget,
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
  return target.node.kind === "initiative" ? listNodeProposals(target.node.id) : [];
}

async function readBlocked(target: DetailTarget): Promise<BlockedDetail> {
  const [assessment, proposals] = await Promise.all([
    settle(readAssessment(target)),
    settle(readProposals(target)),
  ]);
  return { kind: "blocked", key: detailKeyOf(target.node), assessment, proposals };
}

export async function readAttentionDetail(target: DetailTarget): Promise<AttentionDetail> {
  return readBlocked(target);
}
