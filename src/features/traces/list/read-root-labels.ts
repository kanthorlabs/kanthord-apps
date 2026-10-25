import { listTraceSpans } from "@/api/resources/tracking";
import type { TraceSummary } from "@/api/types";
import { spanLabel } from "@/lib/span-labels";

export async function readRootLabels(
  traces: readonly TraceSummary[],
): Promise<ReadonlyMap<string, string>> {
  const settled = await Promise.allSettled(
    traces.map(async (trace) => {
      const spans = await listTraceSpans(trace.trace_id);
      const root = spans.find((span) => span.span_id === trace.root_span_id);
      return root === undefined ? null : spanLabel(root);
    }),
  );
  const labels = new Map<string, string>();
  settled.forEach((result, index) => {
    const trace = traces[index];
    if (result.status === "fulfilled" && result.value !== null && trace !== undefined) {
      labels.set(trace.trace_id, result.value);
    }
  });
  return labels;
}
