import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { type ReactNode, useCallback, useId, useRef } from "react";

import type { EnvironmentState } from "@/api/types";
import { TouchTarget } from "@/components/touch-target";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent } from "@/components/ui/sheet";
import type { AttentionDetails, AttentionItem, ProjectSnapshot } from "@/lib/attention";
import { boardProjectsOf } from "@/lib/board-items";
import type { BoardTab } from "@/lib/board-tabs";
import { positionText } from "@/lib/board-text";
import { BOARD_WIDTH, type BoardWidth } from "@/lib/board-width";

import type { GoneItem } from "../use-board";
import { BoardDetail } from "./board-detail";
import { BoardGone } from "./board-gone";
import type { HeldNode } from "./board-sections";

interface BoardDetailHostProps {
  readonly widthClass: BoardWidth;
  readonly selected: AttentionItem | null;
  readonly gone: GoneItem | null;
  readonly openId: string | null;
  readonly position: number | null;
  readonly total: number;
  readonly tab: BoardTab;
  readonly cards: readonly AttentionItem[];
  readonly details: AttentionDetails;
  readonly now: number;
  readonly held: ReadonlyMap<string, readonly string[]>;
  readonly snapshots: readonly ProjectSnapshot[];
  readonly empty: ReactNode;
  readonly titleRef: (element: HTMLElement | null) => void;
  readonly onClose: () => void;
  readonly onStep: (delta: number) => void;
  readonly onOpen: (itemId: string) => void;
}

const MEDIUM_SHEET = "data-[side=right]:w-[min(560px,100%)] data-[side=right]:sm:max-w-none";
const COMPACT_SHEET = "data-[side=right]:w-full data-[side=right]:sm:max-w-none";

function heldNodesOf(
  ids: readonly string[],
  snapshots: readonly ProjectSnapshot[],
): readonly HeldNode[] {
  return ids.flatMap((id): readonly HeldNode[] => {
    for (const snapshot of snapshots) {
      const node = snapshot.nodes.find((candidate) => candidate.id === id);
      if (node !== undefined) return [{ node, project: snapshot.project }];
    }
    return [];
  });
}

function environmentsOf(
  item: AttentionItem,
  snapshots: readonly ProjectSnapshot[],
): readonly EnvironmentState[] | null {
  const project = boardProjectsOf(item)[0];
  if (project === undefined) return null;
  return snapshots.find((snapshot) => snapshot.project.id === project.id)?.environments ?? null;
}

export function BoardDetailHost({
  widthClass,
  selected,
  gone,
  openId,
  position,
  total,
  tab,
  cards,
  details,
  now,
  held,
  snapshots,
  empty,
  titleRef,
  onClose,
  onStep,
  onOpen,
}: BoardDetailHostProps) {
  const titleId = useId();
  const title = useRef<HTMLElement | null>(null);
  const setTitle = useCallback(
    (element: HTMLElement | null) => {
      title.current = element;
      titleRef(element);
    },
    [titleRef],
  );
  const first = cards[0];

  const step = (delta: number) => {
    onStep(delta);
    title.current?.focus();
  };

  let body: ReactNode = null;
  if (selected !== null) {
    body = (
      <BoardDetail
        item={selected}
        widthClass={widthClass}
        position={position === null ? null : { index: position, total }}
        environments={environmentsOf(selected, snapshots)}
        details={details}
        now={now}
        tabName={tab.name}
        held={heldNodesOf(held.get(selected.id) ?? [], snapshots)}
        titleId={titleId}
        titleRef={setTitle}
      />
    );
  } else if (gone !== null) {
    body = (
      <BoardGone
        subject={gone.item?.subject ?? null}
        hasNext={first !== undefined}
        onNext={() => {
          if (first !== undefined) onOpen(first.id);
        }}
        titleId={titleId}
        titleRef={setTitle}
      />
    );
  }

  if (widthClass === BOARD_WIDTH.Expanded) {
    return <div className="flex min-h-0 flex-col">{body ?? empty}</div>;
  }

  const compact = widthClass === BOARD_WIDTH.Compact;
  return (
    <Sheet
      open={openId !== null && body !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        aria-labelledby={titleId}
        initialFocus={title}
        className={compact ? COMPACT_SHEET : MEDIUM_SHEET}
      >
        <div className="flex items-center gap-2 border-b p-2">
          <TouchTarget>
            <SheetClose render={<Button variant="outline" size="sm" />}>
              {compact ? "Back" : "Close"}
            </SheetClose>
          </TouchTarget>
          {position !== null && (
            <>
              <span className="text-sm text-muted-foreground">{positionText(position, total)}</span>
              <div className="ml-auto flex items-center gap-2">
                <TouchTarget>
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label="Previous card"
                    disabled={position === 0}
                    onClick={() => step(-1)}
                  >
                    <ChevronUpIcon aria-hidden="true" />
                  </Button>
                </TouchTarget>
                <TouchTarget>
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label="Next card"
                    disabled={position === total - 1}
                    onClick={() => step(1)}
                  >
                    <ChevronDownIcon aria-hidden="true" />
                  </Button>
                </TouchTarget>
              </div>
            </>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{body}</div>
      </SheetContent>
    </Sheet>
  );
}
