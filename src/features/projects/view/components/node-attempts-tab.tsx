import { ChevronDownIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DisabledAction } from "@/components/disabled-action";
import { RevealPanel } from "@/components/reveal";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { utcDateTime } from "@/lib/format";
import type { GraphModel } from "@/lib/mission-graph";
import type { SchedulerExecutionRecord } from "@/api/types";
import { endLabel, lastEndOf } from "@/lib/execution-stop";
import { useNodeAttempts } from "../use-node-attempts";
import { type FindingReportState, useFindingReport } from "@/hooks/use-finding-report";
import { useNodeExecutionHistory } from "../use-node-executions";
import { AttemptRecords } from "./attempt-records";
import { AttemptZeroFindings } from "./attempt-zero-findings";
import { ActorLabel } from "./actor-label";
import { FindingReportSheet } from "@/components/finding-report-sheet";

interface NodeAttemptsTabProps {
  readonly projectId: string;
  readonly model: GraphModel;
  readonly nodeId: string;
  readonly currentRevision: number;
  readonly missionVersion: number;
  readonly onChanged: () => void;
}

interface AttemptEndLineProps {
  readonly executions: readonly SchedulerExecutionRecord[] | null;
  readonly attempt: number;
}

function AttemptEndLine({ executions, attempt }: AttemptEndLineProps) {
  const last = lastEndOf((executions ?? []).filter((item) => item.attempt === attempt));
  if (last === null) return null;
  return (
    <>
      <span className="break-words">
        Last execution ended {utcDateTime(last.endedAt)}: {endLabel(last.execution)}
      </span>
      {last.execution.stop?.detail !== undefined && (
        <span className="break-words">Cause: {last.execution.stop.detail}</span>
      )}
    </>
  );
}

function ReportDefectAction({ report }: { report: FindingReportState }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {report.available ? (
        <Button variant="outline" size="sm" onClick={report.requestCreate}>
          Report a defect
        </Button>
      ) : (
        <DisabledAction label="Report a defect" reason={report.unavailableReason} />
      )}
      <FindingReportSheet report={report} />
    </div>
  );
}

export function NodeAttemptsTab({
  projectId,
  model,
  nodeId,
  currentRevision,
  missionVersion,
  onChanged,
}: NodeAttemptsTabProps) {
  const attempts = useNodeAttempts(nodeId);
  const history = useNodeExecutionHistory(projectId, nodeId);
  const report = useFindingReport(nodeId, missionVersion, onChanged);
  const attemptZero = (
    <AttemptZeroFindings
      nodeId={nodeId}
      assessments={report.assessments}
      tasks={model.nodeById.get(nodeId)?.tasks ?? []}
      refreshKey={report.refreshKey}
      onEdit={report.requestEdit}
    />
  );

  if (attempts.loading) return <Skeleton className="h-32 w-full" />;
  if (attempts.data === null) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex flex-col items-start gap-2">
          {attempts.error?.message}
          <Button variant="outline" size="sm" onClick={attempts.reload}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  if (attempts.data.length === 0) {
    return (
      <>
        <ReportDefectAction report={report} />
        <p className="text-sm text-muted-foreground">No attempt of this node opened.</p>
        {attemptZero}
      </>
    );
  }

  return (
    <>
      <ReportDefectAction report={report} />
      {attemptZero}
      <ItemGroup aria-label="Attempts" className="gap-3">
        {attempts.data.map((attempt) => (
          <Collapsible key={attempt.attempt} role="listitem" className="flex flex-col">
            <Item variant="outline" size="sm">
              <ItemContent className="min-w-0">
                <ItemTitle className="w-full flex-wrap">
                  Attempt {attempt.attempt}
                  <Badge variant={attempt.closed_at === null ? "default" : "outline"}>
                    {attempt.closed_at === null ? "open" : "closed"}
                  </Badge>
                </ItemTitle>
                <ItemDescription className="flex flex-col gap-0.5">
                  <span>Pins revision {attempt.node_revision}</span>
                  <span className="break-all">
                    Opened by <ActorLabel actor={attempt.opened_by} />,{" "}
                    {utcDateTime(attempt.opened_at)}
                  </span>
                  {attempt.closed_at !== null && (
                    <span>Closed {utcDateTime(attempt.closed_at)}</span>
                  )}
                  <AttemptEndLine executions={history.data} attempt={attempt.attempt} />
                </ItemDescription>
              </ItemContent>
              <CollapsibleTrigger
                render={<Button variant="outline" size="sm" />}
                aria-label={`Records of attempt ${attempt.attempt}`}
              >
                <ChevronDownIcon aria-hidden="true" data-icon="inline-start" />
                Records
              </CollapsibleTrigger>
            </Item>
            <RevealPanel>
              <div className="pt-3">
                <AttemptRecords
                  projectId={projectId}
                  model={model}
                  attempt={attempt}
                  currentRevision={currentRevision}
                  refreshKey={report.refreshKey}
                  onEditFinding={report.requestEdit}
                />
              </div>
            </RevealPanel>
          </Collapsible>
        ))}
      </ItemGroup>
    </>
  );
}
