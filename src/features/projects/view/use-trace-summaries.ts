import { listTracePage } from "@/api/resources/tracking";
import type { EffectiveCause, SchedulerExecutionRecord, TraceListItem } from "@/api/types";
import { useResource } from "@/hooks/use-resource";
import { costText, PRICE_LABEL, tokenText } from "@/lib/trace-format";

export interface TraceSummaryLine {
  readonly line: string;
  readonly cause: EffectiveCause | null;
}

export type TraceSummaries = ReadonlyMap<string, TraceSummaryLine>;

const NO_SUMMARIES: TraceSummaries = new Map();
const EXPIRED_TEXT = "Trace expired";
const TRACE_LIMIT = 100;

function lineOf(summary: TraceListItem): string {
  return `${summary.turn_count} turns · ${tokenText(summary.total_tokens)} tokens · ${PRICE_LABEL} ${costText(summary.cost_usd)} · ${summary.error_count} errors`;
}

async function readSummaries(nodeId: string, traceIds: readonly string[]): Promise<TraceSummaries> {
  const page = await listTracePage({ node_id: nodeId }, null, TRACE_LIMIT);
  const answered = new Map(page.items.map((item) => [item.trace_id, item]));
  return new Map(
    traceIds.map((id) => {
      const item = answered.get(id);
      const summary: TraceSummaryLine =
        item === undefined
          ? { line: EXPIRED_TEXT, cause: null }
          : { line: lineOf(item), cause: item.cause };
      return [id, summary];
    }),
  );
}

export function useTraceSummaries(
  nodeId: string,
  executions: readonly SchedulerExecutionRecord[] | null,
): TraceSummaries {
  const traceIds = [...new Set((executions ?? []).map((execution) => execution.trace_id))];
  const read = useResource(
    () => (executions === null ? Promise.resolve(NO_SUMMARIES) : readSummaries(nodeId, traceIds)),
    [nodeId, executions === null, traceIds],
  );
  return read.data ?? NO_SUMMARIES;
}
