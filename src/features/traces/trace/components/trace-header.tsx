import { Link } from "react-router-dom";

import type { TraceState, TraceSummary } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { durationText, utcDateTime } from "@/lib/format";
import { nodePath } from "@/lib/node-path";
import { costText, tokenText } from "@/lib/trace-format";

const STATE_BADGES: Readonly<
  Record<
    TraceState,
    { readonly label: string; readonly variant: "secondary" | "outline" | "destructive" }
  >
> = {
  open: { label: "Open", variant: "secondary" },
  ok: { label: "OK", variant: "outline" },
  error: { label: "Error", variant: "destructive" },
};

interface Fact {
  readonly label: string;
  readonly value: string | number;
  readonly identity?: boolean;
}

function factsOf(summary: TraceSummary, projectName: string | null): readonly Fact[] {
  const facts: Fact[] = [];
  if (summary.project_id !== null) {
    facts.push({ label: "Project", value: projectName ?? summary.project_id });
  }
  if (summary.execution_id !== null) {
    facts.push({ label: "Execution", value: summary.execution_id, identity: true });
  }
  if (summary.attempt !== null) facts.push({ label: "Attempt", value: summary.attempt });
  if (summary.worker_name !== null) facts.push({ label: "Worker", value: summary.worker_name });
  if (summary.started_at !== null) {
    facts.push({ label: "Started", value: utcDateTime(summary.started_at) });
  }
  facts.push(
    {
      label: "Duration",
      value: summary.duration_ms === null ? "running" : durationText(summary.duration_ms),
    },
    { label: "Input tokens", value: tokenText(summary.input_tokens) },
    { label: "Output tokens", value: tokenText(summary.output_tokens) },
    {
      label: "Cached tokens",
      value: tokenText(summary.cache_read_tokens + summary.cache_creation_tokens),
    },
    { label: "Est. cost", value: costText(summary.cost_usd) },
  );
  return facts;
}

interface TraceHeaderProps {
  readonly summary: TraceSummary;
  readonly title: string;
  readonly nodeName: string | null;
  readonly projectName: string | null;
  readonly live: boolean;
  readonly paused: boolean;
  readonly onTogglePaused: () => void;
  readonly onJumpToError: (spanId: string) => void;
}

export function TraceHeader({
  summary,
  title,
  nodeName,
  projectName,
  live,
  paused,
  onTogglePaused,
  onJumpToError,
}: TraceHeaderProps) {
  const badge = STATE_BADGES[summary.state];
  const firstError = summary.first_error_span_id;
  return (
    <section aria-label="Trace" className="flex flex-col gap-3 border-b pb-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <h2 className="min-w-0 text-lg font-semibold break-all">
          {summary.project_id !== null && summary.node_id !== null && nodeName !== null ? (
            <Link
              className="underline-offset-4 hover:underline"
              to={nodePath(summary.project_id, summary.node_id)}
            >
              {title}
            </Link>
          ) : (
            title
          )}
        </h2>
        <Badge variant={badge.variant}>{badge.label}</Badge>
        {summary.stop_reason !== null && <Badge variant="outline">{summary.stop_reason}</Badge>}
        {summary.state === "open" && <Badge variant="secondary">{live ? "Live" : "Paused"}</Badge>}
      </div>
      <dl className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-sm">
        {factsOf(summary, projectName).map((fact) => (
          <div key={fact.label} className="flex max-w-full min-w-0 items-baseline gap-1.5">
            <dt className="shrink-0 text-muted-foreground">{fact.label}</dt>
            <dd className={fact.identity === true ? "min-w-0 break-all" : "min-w-0 break-words"}>
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>
      {(firstError !== null || summary.state === "open") && (
        <div className="flex flex-wrap items-center gap-2">
          {firstError !== null && (
            <Button variant="outline" onClick={() => onJumpToError(firstError)}>
              Jump to first error
            </Button>
          )}
          {summary.state === "open" && (
            <Toggle variant="outline" pressed={paused} onPressedChange={onTogglePaused}>
              Pause updates
            </Toggle>
          )}
        </div>
      )}
    </section>
  );
}
