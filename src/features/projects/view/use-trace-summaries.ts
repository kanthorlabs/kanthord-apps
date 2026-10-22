import { readTrace } from "@/api/resources/tracking";
import type { SchedulerExecutionRecord, TraceSummary } from "@/api/types";
import { useResource } from "@/hooks/use-resource";
import { costText, tokenText } from "@/lib/trace-format";
import { settle } from "./settled-read";

export type TraceLines = ReadonlyMap<string, string>;

const NO_LINES: TraceLines = new Map();
const EXPIRED_TEXT = "Trace expired";

function lineOf(summary: TraceSummary): string {
  return `${summary.turn_count} turns · ${tokenText(summary.total_tokens)} tokens · Est. cost ${costText(summary.cost_usd)} · ${summary.error_count} errors`;
}

async function readLines(traceIds: readonly string[]): Promise<TraceLines> {
  const reads = await Promise.all(traceIds.map((id) => settle(readTrace(id))));
  const lines = new Map<string, string>();
  traceIds.forEach((id, index) => {
    const read = reads[index];
    if (read?.data) lines.set(id, lineOf(read.data));
    else if (read?.error.code === "not_found") lines.set(id, EXPIRED_TEXT);
  });
  return lines;
}

export function useTraceSummaries(
  executions: readonly SchedulerExecutionRecord[] | null,
): TraceLines {
  const traceIds = [...new Set((executions ?? []).map((execution) => execution.trace_id))];
  const read = useResource(() => readLines(traceIds), traceIds);
  return read.data ?? NO_LINES;
}
