import { type Ref, useId } from "react";

import { TouchTarget } from "@/components/touch-target";
import { Button } from "@/components/ui/button";
import { selectedGateOf } from "@/lib/board-selection";
import { workforceText } from "@/lib/board-text";

import { BoardActsProvider } from "./board-acts";
import { AllClear } from "./all-clear";
import { DeckCard } from "./deck-card";
import { DeckList } from "./deck-list";
import { DeckStack } from "./deck-stack";
import { DeckSummary } from "./deck-summary";
import type { AskYumiFor } from "../use-ask-yumi";
import { BoardReadsProvider } from "../use-board-reads";
import type { HomeDeck as HomeDeckState } from "../use-home-deck";
import type { OverviewState } from "../use-overview";

interface HomeDeckProps {
  readonly deck: HomeDeckState;
  readonly overview: OverviewState;
  readonly focusRef?: Ref<HTMLDivElement>;
  readonly askYumi: AskYumiFor;
}

const NO_REF = () => undefined;
const NO_CLOSER = () => undefined;

export function HomeDeck({ deck, overview, focusRef, askYumi }: HomeDeckProps) {
  const listId = useId();
  const { primary } = deck;
  const workforce = workforceText(overview.running, overview.waiting);
  const open = deck.list !== null;
  const acting = deck.gone ? null : primary;

  return (
    <section aria-label="Waiting acts" aria-keyshortcuts="ArrowLeft ArrowRight" className="min-w-0">
      <div
        ref={focusRef}
        role="presentation"
        tabIndex={-1}
        className="flex min-w-0 flex-col gap-3 outline-none"
        onKeyDown={deck.onKeyDown}
      >
        {primary === null ? (
          <AllClear titleRef={NO_REF} fault={!overview.allClear} workforce={workforce} />
        ) : (
          <>
            <DeckSummary
              summary={deck.summary}
              startSubject={deck.order[0]?.subject ?? null}
              workforce={workforce}
              cooling={overview.cooling}
              onStart={deck.selectFirst}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm">{deck.countText}</p>
              <TouchTarget>
                <Button
                  variant="outline"
                  size="sm"
                  aria-expanded={open}
                  aria-controls={listId}
                  onClick={deck.toggleList}
                >
                  {open ? "Collapse ▴" : `Expand (${deck.order.length})`}
                </Button>
              </TouchTarget>
            </div>
            {deck.list !== null && (
              <DeckList
                id={listId}
                list={deck.list}
                details={overview.details}
                now={overview.now}
                onQuery={deck.setQuery}
                onTab={deck.setTab}
                onMore={deck.showMore}
                onSelect={deck.select}
              />
            )}
            <BoardReadsProvider item={acting} details={overview.details}>
              <BoardActsProvider
                item={acting}
                details={overview.details}
                snapshots={overview.snapshots}
                reload={overview.refresh}
                retryDetail={overview.retryDetail}
                markActed={deck.markActed}
                closeInboxItem={overview.inbox.close}
                setDialogOpen={deck.setDialogOpen}
                registerDialogCloser={NO_CLOSER}
                gate={selectedGateOf(overview.gates, acting)}
                jump={deck.select}
              >
                <DeckStack deck={deck} details={overview.details}>
                  <DeckCard
                    item={primary}
                    rank={deck.rank}
                    details={overview.details}
                    now={overview.now}
                    held={deck.primaryHeld}
                    gone={deck.gone}
                    askYumi={askYumi(primary)}
                  />
                </DeckStack>
              </BoardActsProvider>
            </BoardReadsProvider>
            <div className="flex items-center justify-between gap-2">
              <TouchTarget>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!deck.canPrevious}
                  onClick={() => deck.step(-1)}
                >
                  ‹ Previous
                </Button>
              </TouchTarget>
              <TouchTarget>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!deck.canNext}
                  onClick={() => deck.step(1)}
                >
                  Next ›
                </Button>
              </TouchTarget>
            </div>
          </>
        )}
        <p role="status" className="min-h-5 text-sm text-muted-foreground">
          {deck.live}
        </p>
      </div>
    </section>
  );
}
