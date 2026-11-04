import type { MissionAssessment, MissionFinding, MissionTaskContent } from "@/api/types";
import { Item, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { useAttemptZeroFindings } from "../use-attempt-zero-findings";
import { FindingSection } from "./finding-section";

interface AttemptZeroFindingsProps {
  readonly nodeId: string;
  readonly assessments: readonly MissionAssessment[];
  readonly tasks: readonly MissionTaskContent[];
  readonly refreshKey: number;
  readonly onEdit: (finding: MissionFinding) => void;
}

export function AttemptZeroFindings({
  nodeId,
  assessments,
  tasks,
  refreshKey,
  onEdit,
}: AttemptZeroFindingsProps) {
  const { findings, reload } = useAttemptZeroFindings(nodeId, refreshKey);
  if (findings === null) return null;

  return (
    <section aria-label="Attempt 0" className="flex flex-col gap-3">
      <Item variant="outline" size="sm">
        <ItemContent className="min-w-0">
          <ItemTitle>Attempt 0</ItemTitle>
          <ItemDescription className="break-words">
            A human act on the node, outside an attempt, wrote these records.
          </ItemDescription>
        </ItemContent>
      </Item>
      <FindingSection
        findings={findings}
        assessments={assessments}
        tasks={tasks}
        onEdit={onEdit}
        reload={reload}
      />
    </section>
  );
}
