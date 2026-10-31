import { type Ref, useId } from "react";

import { TouchTarget } from "@/components/touch-target";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Item, ItemContent, ItemDescription } from "@/components/ui/item";
import type { AttentionItem } from "@/lib/attention";
import { type BoardGate, boardProjectsOf } from "@/lib/board-items";
import { cardCauseOf, heldText } from "@/lib/board-text";
import { relativeAge } from "@/lib/relative-age";

interface BoardCardProps {
  readonly item: AttentionItem;
  readonly now: number;
  readonly held: number;
  readonly gate: BoardGate | null;
  readonly leadLabel: string | null;
  readonly selected: boolean;
  readonly onSelect: (itemId: string) => void;
  readonly titleRef?: Ref<HTMLButtonElement>;
}

export function BoardCard({
  item,
  now,
  held,
  gate,
  leadLabel,
  selected,
  onSelect,
  titleRef,
}: BoardCardProps) {
  const id = useId();
  const causeId = `${id}-cause`;
  const ageId = `${id}-age`;
  const heldId = `${id}-held`;

  return (
    <div role="listitem" className="scroll-mt-[calc(var(--app-header-height)+64px)]">
      <Item
        variant={selected ? "muted" : "outline"}
        size="sm"
        aria-current={selected ? "true" : undefined}
        className="relative"
      >
        <ItemContent className="min-w-0">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <TouchTarget>
              <Button
                ref={titleRef}
                variant="link"
                className="max-w-full min-w-0 after:absolute after:inset-0"
                aria-describedby={`${causeId} ${ageId} ${heldId}`}
                onClick={() => onSelect(item.id)}
              >
                <span className="truncate">{item.subject}</span>
              </Button>
            </TouchTarget>
            <span id={ageId} className="shrink-0 text-sm text-muted-foreground">
              {item.at === null ? "age unknown" : relativeAge(item.at, now)}
            </span>
          </div>
          <ItemDescription id={causeId} className="line-clamp-none">
            {cardCauseOf(item)}
          </ItemDescription>
          <div className="flex flex-wrap items-center gap-1.5">
            {boardProjectsOf(item).map((project) => (
              <Badge key={project.id} variant="outline">
                {project.name}
              </Badge>
            ))}
            <span id={heldId} className="text-sm">
              {heldText(held)}
            </span>
            {gate === null ? (
              leadLabel !== null && <span className="text-sm font-medium">{leadLabel}</span>
            ) : (
              <span className="text-sm text-muted-foreground">Needs: {gate.short}</span>
            )}
          </div>
        </ItemContent>
      </Item>
    </div>
  );
}
