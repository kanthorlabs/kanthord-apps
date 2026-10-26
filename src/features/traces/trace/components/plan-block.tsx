import { useState } from "react";
import { Link } from "react-router-dom";

import { Reveal } from "@/components/reveal";
import { TouchTarget } from "@/components/touch-target";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { nodePath } from "@/lib/node-path";
import type { TraceSpan, TraceSummary } from "@/api/types";

import { usePlan } from "../use-plan";
import type { TraceNode } from "../use-trace-node";

interface ClampedTextProps {
  readonly label: string;
  readonly text: string;
}

function ClampedText({ label, text }: ClampedTextProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      <h4 className="text-sm font-medium">{label}</h4>
      <p hidden={open} className="line-clamp-2 min-w-0 break-words">
        {text}
      </p>
      <Reveal open={open}>
        <p className="min-w-0 break-words whitespace-pre-wrap">{text}</p>
      </Reveal>
      <TouchTarget>
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={open}
          aria-label={`${open ? "Less" : "More"} ${label.toLowerCase()}`}
          onClick={() => setOpen((shown) => !shown)}
        >
          {open ? "Less" : "More"}
        </Button>
      </TouchTarget>
    </div>
  );
}

interface PlanBlockProps {
  readonly summary: TraceSummary;
  readonly spans: readonly TraceSpan[];
  readonly traceNode: TraceNode;
}

export function PlanBlock({ summary, spans, traceNode }: PlanBlockProps) {
  const { plan, error } = usePlan(traceNode, spans);
  const { project_id: projectId, node_id: nodeId } = summary;
  if (error !== null) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }
  if (plan === null) return null;
  return (
    <section aria-label="The plan" className="flex min-w-0 flex-col gap-3">
      <h3 className="min-w-0 text-base font-semibold break-words">
        The plan {plan.name} (v{plan.revision})
      </h3>
      <ClampedText label="Requirement" text={plan.requirement} />
      <ClampedText label="Criterion" text={plan.criterion} />
      <p className="min-w-0 text-sm break-words">
        {plan.tasks.map((task) => `${task.name} ${task.state}`).join(", ")}
      </p>
      {projectId !== null && nodeId !== null && (
        <TouchTarget>
          <Button
            nativeButton={false}
            render={<Link to={nodePath(projectId, nodeId)} />}
            variant="outline"
            className="self-start"
          >
            Open node
          </Button>
        </TouchTarget>
      )}
    </section>
  );
}
