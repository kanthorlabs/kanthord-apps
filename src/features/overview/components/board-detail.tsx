import type { Ref } from "react";

import type { EnvironmentState } from "@/api/types";
import type { AttentionDetails, AttentionItem } from "@/lib/attention";
import type { HeldNode } from "@/lib/board-detail-joins";
import type { BoardGate } from "@/lib/board-items";
import { BOARD_WIDTH, type BoardWidth } from "@/lib/board-width";

import { BoardActBar } from "./board-act-bar";
import { BoardDetailHead, type BoardPosition } from "./board-detail-head";
import { BoardSections } from "./board-sections";

interface BoardDetailProps {
  readonly item: AttentionItem;
  readonly widthClass: BoardWidth;
  readonly position: BoardPosition | null;
  readonly environments: readonly EnvironmentState[] | null;
  readonly gate: BoardGate | null;
  readonly details: AttentionDetails;
  readonly now: number;
  readonly tabName: string;
  readonly held: readonly HeldNode[];
  readonly titleId: string;
  readonly titleRef: Ref<HTMLHeadingElement>;
}

const PANE_LAYOUT = {
  section: "flex min-h-0 flex-1 flex-col gap-3",
  head: "border-b pb-3",
  sections: "min-h-0 flex-1 overflow-y-auto",
  acts: "border-t pt-3",
} as const;

const SHEET_LAYOUT = {
  section: "flex min-h-0 flex-1 flex-col",
  head: "border-b px-4 py-3",
  sections: "min-h-0 flex-1 overflow-y-auto px-4 py-4",
  acts: "border-t px-4 py-3",
} as const;

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
  const layout = widthClass === BOARD_WIDTH.Expanded ? PANE_LAYOUT : SHEET_LAYOUT;
  return (
    <section aria-labelledby={titleId} className={layout.section}>
      <div className={layout.head}>
        <BoardDetailHead
          item={item}
          details={details}
          tabName={tabName}
          widthClass={widthClass}
          position={position}
          now={now}
          titleId={titleId}
          titleRef={titleRef}
        />
      </div>
      <div className={layout.sections}>
        <BoardSections
          item={item}
          details={details}
          widthClass={widthClass}
          now={now}
          held={held}
          environments={environments}
          gate={gate}
        />
      </div>
      <div className={layout.acts}>
        <BoardActBar />
      </div>
    </section>
  );
}
