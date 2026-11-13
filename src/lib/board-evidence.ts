import type {
  EffectiveCause,
  MissionEvidence,
  SchedulerExecutionRecord,
  TraceSpan,
  WorkbenchPendingApproval,
} from "@/api/types";

import type { DetailRead } from "./attention";

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
