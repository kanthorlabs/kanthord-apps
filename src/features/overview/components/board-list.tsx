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
import type { DoneEntry } from "@/lib/board-done";
import type { BoardGate } from "@/lib/board-items";
import { emptyLineOf, tabVerbOf } from "@/lib/board-pane-text";
import { heldCountOf, tabStopIdOf } from "@/lib/board-selection";
import type { BoardTab, BoardTabId } from "@/lib/board-tabs";
import { BOARD_WIDTH, type BoardWidth } from "@/lib/board-width";

import { AllClear } from "./all-clear";
import { BoardCard } from "./board-card";
import { BoardDone } from "./board-done";

interface BoardListProps {
  readonly tab: BoardTab;
  readonly cards: readonly AttentionItem[];
  readonly done: readonly DoneEntry[];
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
  readonly onGoToTab: (tab: BoardTabId) => void;
  readonly cardRef: (itemId: string) => (element: HTMLElement | null) => void;
  readonly allClearRef: (element: HTMLElement | null) => void;
}

export function BoardList({
  tab,
  cards,
  done,
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
  onGoToTab,
  cardRef,
  allClearRef,
}: BoardListProps) {
  const verbId = useId();
  const expanded = widthClass === BOARD_WIDTH.Expanded;
  const filtered = projectName !== null;
  const tabStopId = tabStopIdOf(cards, selectedId);
  const emptyLine = emptyLineOf(tab, projectName);

  return (
    <TabsContent
      value={tab.id}
      tabIndex={cards.length === 0 ? 0 : undefined}
      aria-describedby={verbId}
      className="flex min-w-0 flex-col gap-3"
    >
      <h3 className="sr-only">{tab.name}</h3>
      <p id={verbId} className="text-sm text-muted-foreground">
        {tabVerbOf(tab, widthClass, filtered)}
      </p>
      {cards.length > 0 && (
        <ItemGroup data-board-list="">
          {cards.map((card) => (
            <BoardCard
              key={card.id}
              item={card}
              now={now}
              held={heldCountOf(held, card.id)}
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
      <BoardDone entries={done} onGoTo={onGoToTab} />
    </TabsContent>
  );
}
