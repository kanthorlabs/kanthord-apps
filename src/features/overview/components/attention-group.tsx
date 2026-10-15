import { ItemGroup } from "@/components/ui/item";
import type { AttentionDetails, AttentionGroup as Group, AttentionItem } from "@/lib/attention";
import { detailOf } from "@/lib/attention";

import { DecisionItem } from "./decision-item";

interface AttentionGroupProps {
  readonly group: Group;
  readonly items: readonly AttentionItem[];
  readonly details: AttentionDetails;
  readonly showProject: boolean;
  readonly now: number;
  readonly reload: () => void;
  readonly retryDetail: (nodeId: string) => void;
  readonly setDialogOpen: (nodeId: string, open: boolean) => void;
}

export function AttentionGroup({
  group,
  items,
  details,
  showProject,
  now,
  reload,
  retryDetail,
  setDialogOpen,
}: AttentionGroupProps) {
  return (
    <section aria-labelledby={`attention-${group.id}`} className="flex flex-col gap-2">
      <h4 id={`attention-${group.id}`} className="text-sm font-semibold">
        {group.heading}
      </h4>
      <p className="text-sm text-muted-foreground">{group.description}</p>
      <ItemGroup aria-label={group.heading} className="gap-2">
        {items.map((item) => (
          <DecisionItem
            key={item.id}
            item={item}
            detail={detailOf(details, item.node)}
            showProject={showProject}
            now={now}
            reload={reload}
            retryDetail={retryDetail}
            setDialogOpen={setDialogOpen}
          />
        ))}
      </ItemGroup>
    </section>
  );
}
