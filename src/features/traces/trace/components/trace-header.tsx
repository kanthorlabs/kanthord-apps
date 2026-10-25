import { ArrowLeftIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import type { TraceState, TraceSummary } from "@/api/types";
import { Reveal } from "@/components/reveal";
import { TouchTarget } from "@/components/touch-target";
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

function summaryFactsOf(summary: TraceSummary): readonly Fact[] {
  const facts: Fact[] = [
    {
      label: "Duration",
      value: summary.duration_ms === null ? "running" : durationText(summary.duration_ms),
    },
    { label: "Tokens", value: tokenText(summary.total_tokens) },
    { label: "Est. cost", value: costText(summary.cost_usd) },
  ];
  if (summary.attempt !== null) facts.push({ label: "Attempt", value: summary.attempt });
  return facts;
}

function detailFactsOf(summary: TraceSummary, projectName: string | null): readonly Fact[] {
  const facts: Fact[] = [];
  if (summary.project_id !== null) {
    facts.push({ label: "Project", value: projectName ?? summary.project_id });
  }
  if (summary.execution_id !== null) {
    facts.push({ label: "Execution", value: summary.execution_id, identity: true });
  }
  if (summary.worker_name !== null) facts.push({ label: "Worker", value: summary.worker_name });
  if (summary.started_at !== null) {
    facts.push({ label: "Started", value: utcDateTime(summary.started_at) });
  }
  if (summary.stop_reason !== null) {
    facts.push({ label: "Stop reason", value: summary.stop_reason });
  }
  facts.push(
    { label: "Input tokens", value: tokenText(summary.input_tokens) },
    { label: "Output tokens", value: tokenText(summary.output_tokens) },
    {
      label: "Cached tokens",
      value: tokenText(summary.cache_read_tokens + summary.cache_creation_tokens),
    },
  );
  return facts;
}

function FactList({ facts }: { readonly facts: readonly Fact[] }) {
  return (
    <dl className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-sm">
      {facts.map((fact) => (
        <div key={fact.label} className="flex max-w-full min-w-0 items-baseline gap-1.5">
          <dt className="shrink-0 text-muted-foreground">{fact.label}</dt>
          <dd className={fact.identity === true ? "min-w-0 break-all" : "min-w-0 break-words"}>
            {fact.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

interface TraceHeaderProps {
  readonly summary: TraceSummary;
  readonly title: string;
  readonly nodeName: string | null;
  readonly projectName: string | null;
  readonly live: boolean;
  readonly paused: boolean;
  readonly onTogglePaused: () => void;
}

export function TraceHeader({
  summary,
  title,
  nodeName,
  projectName,
  live,
  paused,
  onTogglePaused,
}: TraceHeaderProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const badge = STATE_BADGES[summary.state];
  return (
    <section aria-label="Trace" className="flex flex-col gap-3 border-b pb-3">
      <TouchTarget>
        <Button
          nativeButton={false}
          render={<Link to="/traces" />}
          variant="ghost"
          size="sm"
          className="self-start"
        >
          <ArrowLeftIcon aria-hidden="true" data-icon="inline-start" />
          Traces
        </Button>
      </TouchTarget>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <h2 className="min-w-0 text-lg font-semibold break-words">
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
        {summary.state === "open" && <Badge variant="secondary">{live ? "Live" : "Paused"}</Badge>}
      </div>
      <FactList facts={summaryFactsOf(summary)} />
      <div className="flex flex-wrap items-center gap-2">
        <TouchTarget>
          <Button
            variant="outline"
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen((open) => !open)}
          >
            Details
          </Button>
        </TouchTarget>
        {summary.state === "open" && (
          <TouchTarget>
            <Toggle variant="outline" pressed={paused} onPressedChange={onTogglePaused}>
              Pause updates
            </Toggle>
          </TouchTarget>
        )}
      </div>
      <Reveal open={detailsOpen}>
        <FactList facts={detailFactsOf(summary, projectName)} />
      </Reveal>
    </section>
  );
}
