import type { TraceSpan, TraceSummary } from "@/api/types";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { durationText } from "@/lib/format";
import { cacheShareText } from "@/lib/trace-format";
import { TIME_LINE_LABELS } from "@/lib/trace-time";

import { useTimeBreakdown } from "../use-time-breakdown";

const PERCENT = 100;

interface TimeBlockProps {
  readonly summary: TraceSummary;
  readonly spans: readonly TraceSpan[];
}

export function TimeBlock({ summary, spans }: TimeBlockProps) {
  const breakdown = useTimeBreakdown(summary, spans);
  return (
    <section aria-label="Where time went" className="flex min-w-0 flex-col gap-3">
      <h3 className="text-base font-semibold">Where time went</h3>
      <p>Total {durationText(breakdown.totalMs)}</p>
      {breakdown.queueWaitMs !== null && <p>Queue wait {durationText(breakdown.queueWaitMs)}</p>}
      <div className="flex min-w-0 flex-col gap-2">
        {breakdown.lines.map((line) => (
          <Progress key={line.line} value={line.share * PERCENT}>
            <ProgressLabel>{TIME_LINE_LABELS[line.line]}</ProgressLabel>
            <ProgressValue>{() => durationText(line.ms)}</ProgressValue>
          </Progress>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        {summary.turn_count} turns, {summary.tool_count} tools, {cacheShareText(summary)} of the
        input tokens came from the cache
      </p>
    </section>
  );
}
