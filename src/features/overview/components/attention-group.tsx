import { ItemGroup } from "@/components/ui/item";
import type { AttentionDetails, AttentionGroup as Group, AttentionItem } from "@/lib/attention";
import { detailOf } from "@/lib/attention";

import { DecisionItem } from "./decision-item";
import { FixItem } from "./fix-item";
import { OutsideItem } from "./outside-item";

interface AttentionGroupProps {
  readonly group: Group;
  readonly items: readonly AttentionItem[];
  readonly details: AttentionDetails;
  readonly showProject: boolean;
  readonly now: number;
  readonly reload: () => void;
  readonly markActed: (itemId: string) => void;
  readonly retryDetail: (nodeId: string) => void;
  readonly setDialogOpen: (itemId: string, nodeId: string, open: boolean) => void;
  readonly titleRef: (itemId: string) => (element: HTMLElement | null) => void;
}

export function AttentionGroup({
  group,
  items,
  details,
  showProject,
  now,
  reload,
  markActed,
  retryDetail,
  setDialogOpen,
  titleRef,
}: AttentionGroupProps) {
  return (
    <section aria-labelledby={`attention-${group.id}`} className="flex flex-col gap-2">
      <h4 id={`attention-${group.id}`} className="text-sm font-semibold">
        {group.heading}
      </h4>
      <p className="text-sm text-muted-foreground">{group.description}</p>
      <ItemGroup aria-label={group.heading} className="gap-2">
        {items.map((item) => {
          if (item.group === "fixes") {
            return (
              <FixItem
                key={item.id}
                item={item}
                showProject={showProject}
                now={now}
                reload={reload}
                markActed={markActed}
                titleRef={titleRef(item.id)}
              />
            );
          }
          return item.group === "outside" ? (
            <OutsideItem
              key={item.id}
              item={item}
              detail={detailOf(details, item.node)}
              showProject={showProject}
              now={now}
              reload={reload}
              markActed={markActed}
              titleRef={titleRef(item.id)}
            />
          ) : (
            <DecisionItem
              key={item.id}
              item={item}
              detail={detailOf(details, item.node)}
              showProject={showProject}
              now={now}
              reload={reload}
              markActed={markActed}
              retryDetail={retryDetail}
              setDialogOpen={setDialogOpen}
              titleRef={titleRef(item.id)}
            />
          );
        })}
      </ItemGroup>
    </section>
  );
}
