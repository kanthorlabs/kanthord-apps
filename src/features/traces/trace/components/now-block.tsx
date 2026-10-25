import type { TraceSpan } from "@/api/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { nowFactsOf } from "@/lib/trace-now";

import { TRACE_POLL_MS } from "../use-trace";

interface NowBlockProps {
  readonly spans: readonly TraceSpan[];
  readonly now: number;
}

export function NowBlock({ spans, now }: NowBlockProps) {
  const facts = nowFactsOf(spans, now, TRACE_POLL_MS);
  return (
    <section aria-label="Now" className="flex min-w-0 flex-col gap-3">
      <h3 className="text-base font-semibold">Now</h3>
      {facts.runningLabel === null ? (
        <p className="text-muted-foreground">No span is running.</p>
      ) : (
        <p>
          {facts.runningLabel} is running
          {facts.age === null ? "" : ` for ${facts.age}`}.
        </p>
      )}
      {facts.sinceLatestRecord !== null && (
        <p className="text-sm text-muted-foreground">Last record {facts.sinceLatestRecord} ago.</p>
      )}
      {facts.gapWarning !== null && (
        <Alert variant="destructive">
          <AlertDescription>{facts.gapWarning}</AlertDescription>
        </Alert>
      )}
    </section>
  );
}
