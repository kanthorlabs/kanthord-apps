import type { TraceSpan, TraceSummary } from "@/api/types";
import { useLargeScreen } from "@/hooks/use-large-screen";

import { useNodeTraces } from "../use-node-traces";
import { useNow } from "../use-now";
import type { TraceSelection } from "../use-trace-selection";
import { AttemptsBlock } from "./attempts-block";
import { DiagnosisBlock } from "./diagnosis-block";
import { NowBlock } from "./now-block";
import { PlanBlock } from "./plan-block";
import { PromptBlock } from "./prompt-block";
import { StepsTab } from "./steps-tab";
import { TimeBlock } from "./time-block";

interface SummaryTabProps {
  readonly summary: TraceSummary;
  readonly spans: readonly TraceSpan[];
  readonly selection: TraceSelection;
  readonly onLabeled: () => void;
}

export function SummaryTab({ summary, spans, selection, onLabeled }: SummaryTabProps) {
  const nodeTraces = useNodeTraces(summary);
  const open = summary.state === "open";
  const now = useNow(open);
  const large = useLargeScreen();
  const steps = (
    <StepsTab
      traceId={summary.trace_id}
      summary={summary}
      spans={spans}
      traceState={summary.state}
      selection={selection}
    />
  );
  if (!large && selection.span !== null) return steps;
  return (
    <div className="flex min-w-0 flex-col gap-6">
      {open ? (
        <NowBlock traceId={summary.trace_id} spans={spans} now={now} />
      ) : (
        <DiagnosisBlock
          summary={summary}
          spans={spans}
          nodeTraces={nodeTraces}
          now={now}
          selectedSpanId={selection.span}
          onSelectSpan={selection.selectSpan}
          onLabeled={onLabeled}
        />
      )}
      {large && steps}
      <AttemptsBlock node={nodeTraces} />
      <div className="grid min-w-0 gap-6 lg:grid-cols-3">
        <TimeBlock summary={summary} spans={spans} />
        <PlanBlock summary={summary} spans={spans} />
        <PromptBlock traceId={summary.trace_id} spans={spans} selection={selection} />
      </div>
    </div>
  );
}
