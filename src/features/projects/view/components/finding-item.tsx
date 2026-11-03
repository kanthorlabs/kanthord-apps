import type { MissionAssessment, MissionFinding, MissionFindingDecision } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import {
  causeOwnerText,
  decisionText,
  isEditableFinding,
  missedAssessmentText,
  reporterText,
  routeText,
  waitsForHuman,
} from "@/lib/review-findings";

interface FindingItemProps {
  readonly finding: MissionFinding;
  readonly taskName: string | null;
  readonly assessments: readonly MissionAssessment[];
  readonly onDecide: (finding: MissionFinding, decision: MissionFindingDecision) => void;
  readonly onEdit: (finding: MissionFinding) => void;
}

export function FindingItem({
  finding,
  taskName,
  assessments,
  onDecide,
  onEdit,
}: FindingItemProps) {
  const decided = decisionText(finding);
  const causeOwner = causeOwnerText(finding);
  const human = finding.source === "human";
  const decidable = waitsForHuman(finding);
  const editable = isEditableFinding(finding);

  return (
    <Item variant="outline" size="sm" role="listitem">
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full flex-wrap break-words">
          <span className="font-mono">{finding.label}</span>
          {finding.name}
          <Badge variant={finding.kind === "blocker" ? "destructive" : "outline"}>
            {finding.kind}
          </Badge>
          <Badge variant="outline">action: {finding.action}</Badge>
          <Badge variant={finding.status === "fixed" ? "secondary" : "outline"}>
            {finding.status}
          </Badge>
          <Badge variant="outline">{routeText(finding.route)}</Badge>
        </ItemTitle>
        <ItemDescription className="flex flex-col gap-0.5">
          {taskName !== null && <span className="break-words">Task: {taskName}</span>}
          <span className="break-words text-foreground">{finding.description}</span>
          <span className="break-words">Fix: {finding.fix}</span>
          <span className="break-words">Why: {finding.why}</span>
          {human && (
            <>
              {causeOwner !== null && <span>{causeOwner}</span>}
              <span className="break-words">{reporterText(finding)}</span>
              <span className="break-words">{missedAssessmentText(finding, assessments)}</span>
            </>
          )}
          {decided !== null && <span className="break-words text-foreground">{decided}</span>}
        </ItemDescription>
      </ItemContent>
      {(decidable || editable) && (
        <ItemActions className="basis-full flex-wrap md:basis-auto md:justify-end">
          {decidable && (
            <>
              <Button
                variant="outline"
                size="sm"
                aria-label={`Accept the finding ${finding.label}`}
                onClick={() => onDecide(finding, "accepted")}
              >
                Accept
              </Button>
              <Button
                variant="outline"
                size="sm"
                aria-label={`Dismiss the finding ${finding.label}`}
                onClick={() => onDecide(finding, "dismissed")}
              >
                Dismiss
              </Button>
            </>
          )}
          {editable && (
            <Button
              variant="outline"
              size="sm"
              aria-label={`Edit the finding ${finding.label}`}
              onClick={() => onEdit(finding)}
            >
              Edit
            </Button>
          )}
        </ItemActions>
      )}
    </Item>
  );
}
