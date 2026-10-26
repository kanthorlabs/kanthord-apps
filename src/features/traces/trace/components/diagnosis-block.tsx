import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import type { EffectiveCause, TraceSpan, TraceSummary } from "@/api/types";
import { DataList } from "@/components/data-list";
import { DataListItem } from "@/components/data-list-item";
import { TouchTarget } from "@/components/touch-target";
import { Button } from "@/components/ui/button";
import { causeLine } from "@/lib/trace-cause";
import { errorStepIndexOf } from "@/lib/trace-diagnosis";

import { useDiagnosis, type Diagnosis } from "../use-diagnosis";
import type { NodeTraces } from "../use-node-traces";
import type { TraceNode } from "../use-trace-node";
import { LabelCauseSheet } from "./label-cause-sheet";

interface DiagnosisBlockProps {
  readonly summary: TraceSummary;
  readonly spans: readonly TraceSpan[];
  readonly nodeTraces: NodeTraces;
  readonly traceNode: TraceNode;
  readonly now: number;
  readonly selectedSpanId: string | null;
  readonly onSelectSpan: (spanId: string) => void;
  readonly onLabeled: () => void;
}

interface ErrorStepperProps {
  readonly steps: readonly string[];
  readonly index: number;
  readonly onSelectSpan: (spanId: string) => void;
}

function ErrorStepper({ steps, index, onSelectSpan }: ErrorStepperProps) {
  const go = (offset: number) => {
    const target = steps[index + offset];
    if (target !== undefined) onSelectSpan(target);
  };
  return (
    <div role="group" aria-label="Error stepper" className="flex items-center gap-1">
      <TouchTarget>
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous error"
          disabled={index <= 0}
          onClick={() => go(-1)}
        >
          <ChevronLeftIcon aria-hidden="true" />
        </Button>
      </TouchTarget>
      <span className="text-sm">
        {index + 1}/{steps.length} errors
      </span>
      <TouchTarget>
        <Button
          variant="outline"
          size="icon"
          aria-label="Next error"
          disabled={index >= steps.length - 1}
          onClick={() => go(1)}
        >
          <ChevronRightIcon aria-hidden="true" />
        </Button>
      </TouchTarget>
    </div>
  );
}

interface FailureProps extends DiagnosisBlockProps {
  readonly diagnosis: Diagnosis;
  readonly cause: EffectiveCause;
  readonly causalSpan: TraceSpan;
}

function Failure({
  summary,
  selectedSpanId,
  onSelectSpan,
  onLabeled,
  diagnosis,
  cause,
  causalSpan,
}: FailureProps) {
  const [labeling, setLabeling] = useState(false);
  const { labeledBy, reason, reasonError, sentence, evidence, errorSteps } = diagnosis;
  const index = errorStepIndexOf(errorSteps, causalSpan.span_id, selectedSpanId);
  return (
    <>
      <p className="font-medium">{causeLine(cause)}</p>
      {labeledBy !== null && (
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-sm">Labeled by {labeledBy}</p>
          {reason !== null && <p className="text-sm break-words">{reason}</p>}
          {reasonError !== null && (
            <p role="alert" className="text-sm text-destructive">
              {reasonError.message}
            </p>
          )}
        </div>
      )}
      {sentence !== null && <p className="break-words">{sentence}</p>}
      {evidence.length > 0 && (
        <div className="flex min-w-0 flex-col gap-2">
          <h4 className="text-sm font-medium">Evidence</h4>
          <DataList
            label="Evidence lines"
            items={evidence}
            getKey={(line) => `${line.spanId}|${line.text}`}
            renderItem={(line) => (
              <DataListItem
                title={line.text}
                select={{
                  label: line.text,
                  disabled: false,
                  onSelect: () => onSelectSpan(line.spanId),
                }}
              />
            )}
            status="ready"
            error={null}
            pending={false}
            emptyText="No evidence recorded."
          />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <TouchTarget>
          <Button onClick={() => onSelectSpan(causalSpan.span_id)}>Open causal span</Button>
        </TouchTarget>
        <TouchTarget>
          <Button variant="outline" onClick={() => setLabeling(true)}>
            Label cause
          </Button>
        </TouchTarget>
        <ErrorStepper steps={errorSteps} index={index} onSelectSpan={onSelectSpan} />
      </div>
      <LabelCauseSheet
        traceId={summary.trace_id}
        cause={cause}
        open={labeling}
        onOpenChange={setLabeling}
        onLabeled={onLabeled}
      />
    </>
  );
}

export function DiagnosisBlock(props: DiagnosisBlockProps) {
  const { summary, spans, nodeTraces, traceNode, now } = props;
  const diagnosis = useDiagnosis(summary, spans, nodeTraces, now, traceNode.taskNames);
  const { cause, causalSpan, rework, recoveredCount } = diagnosis;
  return (
    <section aria-label="What went wrong" className="flex min-w-0 flex-col gap-3">
      <h3 className="text-base font-semibold">What went wrong</h3>
      {cause !== null && causalSpan !== null && (
        <Failure {...props} diagnosis={diagnosis} cause={cause} causalSpan={causalSpan} />
      )}
      {cause === null && rework !== null && (
        <>
          <p className="font-medium">Reworked by review</p>
          <p>{causeLine(rework.cause)}</p>
          <TouchTarget>
            <Button
              nativeButton={false}
              render={<Link to={rework.path} />}
              variant="outline"
              size="sm"
              className="self-start"
            >
              Open evaluation trace
            </Button>
          </TouchTarget>
        </>
      )}
      {cause === null && rework === null && (
        <>
          <p className="font-medium">No failure</p>
          <p className="text-sm text-muted-foreground">Recovered errors: {recoveredCount}</p>
        </>
      )}
    </section>
  );
}
