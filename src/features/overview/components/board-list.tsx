import { useId } from "react";

import { TouchTarget } from "@/components/touch-target";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { ItemGroup } from "@/components/ui/item";
import { TabsContent } from "@/components/ui/tabs";
import type { AttentionItem } from "@/lib/attention";
import type { BoardGate } from "@/lib/board-items";
import { BOARD_TAB, type BoardTab } from "@/lib/board-tabs";
import { BOARD_WIDTH, type BoardWidth } from "@/lib/board-width";

import { AllClear } from "./all-clear";
import { BoardCard } from "./board-card";

interface BoardListProps {
  readonly tab: BoardTab;
  readonly cards: readonly AttentionItem[];
  readonly selectedId: string | null;
  readonly widthClass: BoardWidth;
  readonly projectName: string | null;
  readonly hiddenByFilter: boolean;
  readonly allClear: boolean;
  readonly nothingAtAll: boolean;
  readonly start: AttentionItem | null;
  readonly workforce: string;
  readonly now: number;
  readonly held: ReadonlyMap<string, readonly string[]>;
  readonly gates: ReadonlyMap<string, BoardGate>;
  readonly leadLabelOf: (item: AttentionItem) => string | null;
  readonly onSelect: (itemId: string) => void;
  readonly onShowAll: () => void;
  readonly onGoToStart: () => void;
  readonly cardRef: (itemId: string) => (element: HTMLElement | null) => void;
  readonly allClearRef: (element: HTMLElement | null) => void;
}

const ALL_PROJECTS_NOTE = "Counts all projects.";

export function BoardList({
  tab,
  cards,
  selectedId,
  widthClass,
  projectName,
  hiddenByFilter,
  allClear,
  nothingAtAll,
  start,
  workforce,
  now,
  held,
  gates,
  leadLabelOf,
  onSelect,
  onShowAll,
  onGoToStart,
  cardRef,
  allClearRef,
}: BoardListProps) {
  const verbId = useId();
  const expanded = widthClass === BOARD_WIDTH.Expanded;
  const filtered = projectName !== null;
  const tabStopId = cards.some((card) => card.id === selectedId) ? selectedId : cards[0]?.id;
  const emptyLine = `Nothing waits in ${tab.name}${filtered ? ` in ${projectName}` : ""}.`;

  return (
    <TabsContent
      value={tab.id}
      tabIndex={cards.length === 0 ? 0 : undefined}
      aria-describedby={verbId}
      className="flex min-w-0 flex-col gap-3"
    >
      <h3 className="sr-only">{tab.name}</h3>
      <p id={verbId} className="text-sm text-muted-foreground">
        {tab.verb}
        {widthClass === BOARD_WIDTH.Medium && ` ${tab.what}`}
        {filtered && tab.id === BOARD_TAB.Tool && ` ${ALL_PROJECTS_NOTE}`}
      </p>
      {cards.length > 0 && (
        <ItemGroup data-board-list="">
          {cards.map((card) => (
            <BoardCard
              key={card.id}
              item={card}
              now={now}
              held={held.get(card.id)?.length ?? 0}
              gate={gates.get(card.id) ?? null}
              leadLabel={leadLabelOf(card)}
              selected={card.id === selectedId}
              tabStop={card.id === tabStopId}
              onSelect={onSelect}
              titleRef={cardRef(card.id)}
            />
          ))}
        </ItemGroup>
      )}
      {cards.length === 0 && expanded && <p className="text-sm">{emptyLine}</p>}
      {cards.length === 0 && !expanded && nothingAtAll && (
        <AllClear titleRef={allClearRef} fault={!allClear} workforce={workforce} />
      )}
      {cards.length === 0 && !expanded && !nothingAtAll && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{emptyLine}</EmptyTitle>
            <EmptyDescription>{tab.what}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            {hiddenByFilter && (
              <TouchTarget>
                <Button variant="outline" size="sm" onClick={onShowAll}>
                  Show all projects
                </Button>
              </TouchTarget>
            )}
            {start !== null && (
              <TouchTarget>
                <Button variant="outline" size="sm" onClick={onGoToStart}>
                  Go to {start.subject}
                </Button>
              </TouchTarget>
            )}
          </EmptyContent>
        </Empty>
      )}
    </TabsContent>
  );
}
