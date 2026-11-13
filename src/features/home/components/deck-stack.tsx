import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { AttentionDetails } from "@/lib/attention";
import { boardTabNamed, boardTabOf } from "@/lib/board-tabs";

import { DECK_EXIT_MS, type HomeDeck } from "../use-home-deck";

const TILT_CLASSES = [
  "z-20 origin-[50%_120%] [transform:translateY(-26px)_rotate(2deg)] sm:[transform:translateY(-26px)_rotate(2deg)]",
  "z-10 origin-[50%_120%] [transform:translateY(-16px)_rotate(-3deg)] sm:[transform:translateY(-14px)_rotate(-3deg)]",
  "z-0 origin-[50%_120%] [transform:translateY(-15px)_rotate(-4deg)] sm:[transform:translateY(-8px)_rotate(-5deg)]",
] as const;

const EXIT_DURATION = { transitionDuration: `${DECK_EXIT_MS}ms` };

interface DeckStackProps {
  readonly deck: HomeDeck;
  readonly details: AttentionDetails;
  readonly children: ReactNode;
}

interface SecondaryProps {
  readonly deck: HomeDeck;
  readonly details: AttentionDetails;
}

function Secondary({ deck, details }: SecondaryProps) {
  const { secondary } = deck;
  if (secondary === null) return null;
  return (
    <Card size="sm" className="flex-1 gap-0 py-0">
      <CardContent className="flex min-w-0 flex-row items-center gap-2 py-0.5">
        <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
          Next #{secondary.rank} {secondary.item.subject}
        </p>
        <Badge variant="outline">{boardTabNamed(boardTabOf(secondary.item, details)).short}</Badge>
        {secondary.isNew && <Badge variant="secondary">New</Badge>}
      </CardContent>
    </Card>
  );
}

export function DeckStack({ deck, details, children }: DeckStackProps) {
  const tilts = TILT_CLASSES.slice(0, deck.tilted);
  const exit = deck.leaving
    ? "translate-x-[110%] opacity-0 motion-reduce:translate-x-0"
    : "translate-x-0 opacity-100";

  return (
    <div className="isolate grid grid-cols-[minmax(0,1fr)] pt-[34px] pb-2 sm:pt-10 sm:pb-[26px]">
      {tilts.map((tilt, index) => (
        <div
          key={tilt}
          aria-hidden={index === 0 ? undefined : true}
          className={`col-start-1 row-start-1 flex ${index === 0 ? "self-start" : ""} ${tilt}`}
        >
          {index === 0 ? (
            <Secondary deck={deck} details={details} />
          ) : (
            <Card size="sm" className="flex-1 bg-background" />
          )}
        </div>
      ))}
      <div
        inert={deck.leaving}
        style={EXIT_DURATION}
        className={`z-30 col-start-1 row-start-1 touch-pan-y transition-[translate,opacity] ease-in motion-reduce:transition-none ${exit}`}
        onPointerDown={deck.swipe.onPointerDown}
        onPointerUp={deck.swipe.onPointerUp}
        onPointerCancel={deck.swipe.onPointerCancel}
        onClickCapture={deck.swipe.onClickCapture}
      >
        {children}
      </div>
    </div>
  );
}
