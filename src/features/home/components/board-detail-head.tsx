import type { Ref } from "react";

import { Badge } from "@/components/ui/badge";
import type { AttentionDetails, AttentionItem } from "@/lib/attention";
import { boardProjectsOf } from "@/lib/board-items";
import { ageTextOf } from "@/lib/board-pane-text";
import { detailTitleOf, positionText } from "@/lib/board-text";
import { BOARD_WIDTH, type BoardWidth } from "@/lib/board-width";
import { badgeVariantOf } from "@/lib/node-state";

export interface BoardPosition {
  readonly index: number;
  readonly total: number;
}

interface BoardDetailHeadProps {
  readonly item: AttentionItem;
  readonly details: AttentionDetails;
  readonly tabName: string;
  readonly widthClass: BoardWidth;
  readonly position: BoardPosition | null;
  readonly now: number;
  readonly titleId: string;
  readonly titleRef: Ref<HTMLHeadingElement>;
}

export function BoardDetailHead({
  item,
  details,
  tabName,
  widthClass,
  position,
  now,
  titleId,
  titleRef,
}: BoardDetailHeadProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {boardProjectsOf(item).map((project) => (
          <Badge key={project.id} variant="outline">
            {project.name}
          </Badge>
        ))}
        <Badge variant="secondary">{tabName}</Badge>
        {"node" in item && (
          <Badge variant={badgeVariantOf(item.node.state)}>{item.node.state}</Badge>
        )}
        <span className="text-sm text-muted-foreground">{ageTextOf(item.at, now)}</span>
      </div>
      <div className="flex items-start justify-between gap-2">
        <h3
          id={titleId}
          ref={titleRef}
          tabIndex={-1}
          className="text-base font-semibold break-words"
        >
          {detailTitleOf(item, details)}
        </h3>
        {widthClass === BOARD_WIDTH.Expanded && position !== null && (
          <span className="shrink-0 text-sm text-muted-foreground">
            {positionText(position.index, position.total)}
          </span>
        )}
      </div>
    </div>
  );
}
