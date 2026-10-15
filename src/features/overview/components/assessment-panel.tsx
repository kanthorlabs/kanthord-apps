import type { MissionProposal } from "@/api/types";
import { Button } from "@/components/ui/button";
import { RecordName } from "@/components/record-name";
import type { BlockedDetail, BlockedItem } from "@/lib/attention";
import { requestText } from "@/lib/mission-labels";

interface AssessmentPanelProps {
  readonly item: BlockedItem;
  readonly detail: BlockedDetail | null;
  readonly proposals: readonly MissionProposal[];
  readonly onRetry: () => void;
}

export function AssessmentPanel({ item, detail, proposals, onRetry }: AssessmentPanelProps) {
  const requests = item.node.blocked_context?.requests ?? [];

  return (
    <div className="flex flex-col gap-3 pt-3 text-sm">
      <div className="flex flex-col gap-1">
        <p className="font-medium">Rationale</p>
        {detail === null && <p className="text-muted-foreground">Reading the assessment.</p>}
        {detail?.assessment.status === "failed" && (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-destructive break-words">
              The assessment could not be read: {detail.assessment.message}
            </p>
            <Button variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          </div>
        )}
        {detail?.assessment.status === "ready" && (
          <p className="break-words">
            {detail.assessment.data === null
              ? "The daemon holds no assessment for this outcome."
              : detail.assessment.data.rationale}
          </p>
        )}
      </div>
      {requests.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="font-medium">Requests</p>
          {requests.map((request) => (
            <p key={request.id} className="break-words">
              {requestText(request)}
            </p>
          ))}
        </div>
      )}
      {proposals.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="font-medium">Open fix proposal</p>
          {proposals.map((proposal) => (
            <p key={proposal.id} className="break-words">
              <RecordName>{proposal.content.name}</RecordName>: {proposal.content.requirement}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
