import type { Ref } from "react";

import type { EnvironmentState } from "@/api/types";
import type { AttentionDetails, AttentionItem } from "@/lib/attention";
import type { BoardGate } from "@/lib/board-items";
import { BOARD_WIDTH, type BoardWidth } from "@/lib/board-width";

import { BoardActBar } from "./board-act-bar";
import { type BoardPosition, BoardSections, type HeldNode } from "./board-sections";

interface BoardDetailProps {
  readonly item: AttentionItem;
  readonly widthClass: BoardWidth;
  readonly position: BoardPosition | null;
  readonly environments: readonly EnvironmentState[] | null;
  readonly gate?: BoardGate | null;
  readonly details: AttentionDetails;
  readonly now: number;
  readonly tabName: string;
  readonly held: readonly HeldNode[];
  readonly titleId: string;
  readonly titleRef: Ref<HTMLHeadingElement>;
}

export function BoardDetail({
  item,
  widthClass,
  position,
  environments,
  gate,
  details,
  now,
  tabName,
  held,
  titleId,
  titleRef,
}: BoardDetailProps) {
  const expanded = widthClass === BOARD_WIDTH.Expanded;
  const sections = (
    <BoardSections
      item={item}
      details={details}
      tabName={tabName}
      widthClass={widthClass}
      position={position}
      now={now}
      held={held}
      environments={environments}
      gate={gate}
      titleId={titleId}
      titleRef={titleRef}
    />
  );

  if (!expanded) {
    return (
      <section aria-labelledby={titleId} className="flex flex-col gap-4">
        {sections}
        <BoardActBar />
      </section>
    );
  }
  return (
    <section aria-labelledby={titleId} className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="min-h-0 flex-1 overflow-y-auto">{sections}</div>
      <div className="border-t pt-3">
        <BoardActBar />
      </div>
    </section>
  );
}
