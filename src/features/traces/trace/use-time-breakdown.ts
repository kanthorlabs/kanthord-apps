import { useEffect, useMemo, useState } from "react";

import type { TraceSpan, TraceSummary } from "@/api/types";
import { timeBreakdown, type TimeBreakdown } from "@/lib/trace-time";

const TICK_MS = 1000;

export function useTimeBreakdown(
  summary: TraceSummary,
  spans: readonly TraceSpan[],
): TimeBreakdown {
  const [now, setNow] = useState(() => Date.now());
  const open = summary.state === "open";
  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [open]);
  return useMemo(() => timeBreakdown(summary, spans, now), [summary, spans, now]);
}
