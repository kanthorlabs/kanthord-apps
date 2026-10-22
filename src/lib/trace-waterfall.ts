import type { TraceSpan, TraceState } from "@/api/types";

export interface TraceAxis {
  readonly start: number;
  readonly end: number;
}

export interface WaterfallBar {
  readonly offsetPercent: number;
  readonly widthPercent: number;
  readonly running: boolean;
  readonly noEnd: boolean;
}

const MIN_WIDTH_PERCENT = 0.5;
const OPEN_STATE: TraceState = "open";

function timesOf(spans: readonly TraceSpan[], field: "start_time" | "end_time"): number[] {
  return spans.flatMap((span) => span[field] ?? []);
}

export function traceAxis(spans: readonly TraceSpan[]): TraceAxis | null {
  const starts = timesOf(spans, "start_time");
  const all = [...starts, ...timesOf(spans, "end_time")];
  if (all.length === 0) return null;
  return {
    start: Math.min(...(starts.length > 0 ? starts : all)),
    end: Math.max(...all),
  };
}

function bar(
  axis: TraceAxis,
  start: number,
  end: number,
  flags: Pick<WaterfallBar, "running" | "noEnd">,
  minimumWidth: boolean,
): WaterfallBar {
  const length = axis.end - axis.start;
  if (length === 0) return { offsetPercent: 0, widthPercent: 100, ...flags };
  const width = ((end - start) / length) * 100;
  return {
    offsetPercent: ((start - axis.start) / length) * 100,
    widthPercent: minimumWidth ? Math.max(width, MIN_WIDTH_PERCENT) : width,
    ...flags,
  };
}

export function waterfallBar(
  span: TraceSpan,
  axis: TraceAxis,
  traceState: TraceState,
): WaterfallBar {
  const { start_time: start, end_time: end } = span;
  const idle = { running: false, noEnd: false };
  if (start !== null && end !== null) return bar(axis, start, end, idle, true);
  if (start !== null && traceState === OPEN_STATE) {
    return bar(axis, start, axis.end, { running: true, noEnd: false }, true);
  }
  if (start !== null) return bar(axis, start, start, { running: false, noEnd: true }, false);
  if (end !== null) return bar(axis, end, end, idle, false);
  return bar(axis, axis.start, axis.start, idle, false);
}
