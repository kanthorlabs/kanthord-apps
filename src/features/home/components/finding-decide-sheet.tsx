import type { MissionAssessment, MissionFinding, MissionFindingDecision } from "@/api/types";
import { FindingItem } from "@/components/finding-item";
import { ItemGroup } from "@/components/ui/item";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import type { FindingReviewItem } from "@/lib/attention";
import { boardFindingGroupsOf } from "@/lib/board-section-facts";
import { taskNameOf } from "@/lib/review-findings";

interface FindingDecideSheetProps {
  readonly item: FindingReviewItem;
  readonly open: boolean;
  readonly assessments: readonly MissionAssessment[];
  readonly onOpenChange: (open: boolean) => void;
  readonly onDecide: (finding: MissionFinding, decision: MissionFindingDecision) => void;
  readonly onEdit: (finding: MissionFinding) => void;
}

export function FindingDecideSheet({
  item,
  open,
  assessments,
  onOpenChange,
  onDecide,
  onEdit,
}: FindingDecideSheetProps) {
  const mobile = useIsMobile();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={mobile ? "bottom" : "right"}
        className="data-[side=bottom]:max-h-[85svh] data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
      >
        <SheetHeader>
          <SheetTitle className="mr-8 break-words">
            Decide findings of {item.node.content.name}
          </SheetTitle>
          <SheetDescription>
            KanthorD fixes none of them. Accept or dismiss each finding.
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
          {boardFindingGroupsOf(item.findings).map((group) => (
            <div key={group.key} className="flex flex-col gap-2">
              <h5 className="text-sm text-muted-foreground">{group.title}</h5>
              <ItemGroup aria-label={group.title}>
                {group.findings.map((finding) => (
                  <FindingItem
                    key={finding.id}
                    finding={finding}
                    taskName={taskNameOf(finding, item.node.tasks)}
                    assessments={assessments}
                    onDecide={onDecide}
                    onEdit={onEdit}
                  />
                ))}
              </ItemGroup>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
