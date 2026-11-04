import type {
  MissionAssessment,
  MissionFinding,
  MissionFindingDecision,
  MissionTaskContent,
} from "@/api/types";
import { FindingDecisionDialog } from "@/components/finding-decision-dialog";
import { FindingItem } from "@/components/finding-item";
import { ItemGroup } from "@/components/ui/item";
import { useFindingDecision } from "@/hooks/use-finding-decision";
import { findingGroupsOf, taskNameOf } from "@/lib/review-findings";
import type { SettledRead } from "../settled-read";
import { RecordSection } from "./record-section";

const NO_ASSESSMENTS: readonly MissionAssessment[] = [];

interface FindingSectionProps {
  readonly findings: SettledRead<readonly MissionFinding[]>;
  readonly assessments: readonly MissionAssessment[] | null;
  readonly tasks: readonly MissionTaskContent[];
  readonly onEdit: (finding: MissionFinding) => void;
  readonly reload: () => void;
}

export function FindingSection({
  findings,
  assessments,
  tasks,
  onEdit,
  reload,
}: FindingSectionProps) {
  const decision = useFindingDecision(reload);

  return (
    <>
      <FindingRecords
        findings={findings}
        assessments={assessments}
        tasks={tasks}
        onDecide={decision.request}
        onEdit={onEdit}
      />
      <FindingDecisionDialog decision={decision} />
    </>
  );
}

interface FindingRecordsProps {
  readonly findings: SettledRead<readonly MissionFinding[]>;
  readonly assessments: readonly MissionAssessment[] | null;
  readonly tasks: readonly MissionTaskContent[];
  readonly onDecide: (finding: MissionFinding, decision: MissionFindingDecision) => void;
  readonly onEdit: (finding: MissionFinding) => void;
}

function FindingRecords({ findings, assessments, tasks, onDecide, onEdit }: FindingRecordsProps) {
  return (
    <RecordSection title="Findings" read={findings}>
      {(items) =>
        items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No review finding names this attempt.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {findingGroupsOf(items).map((group) => (
              <div key={group.key} className="flex flex-col gap-2">
                <h5 className="text-sm text-muted-foreground">{group.title}</h5>
                <ItemGroup aria-label={group.title}>
                  {group.findings.map((finding) => (
                    <FindingItem
                      key={finding.id}
                      finding={finding}
                      taskName={taskNameOf(finding, tasks)}
                      assessments={assessments ?? NO_ASSESSMENTS}
                      onDecide={onDecide}
                      onEdit={onEdit}
                    />
                  ))}
                </ItemGroup>
              </div>
            ))}
          </div>
        )
      }
    </RecordSection>
  );
}
