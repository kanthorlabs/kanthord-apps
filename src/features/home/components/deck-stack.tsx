import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import { DECK_EXIT_MS, type HomeDeck } from "../use-home-deck";

const TILT_CLASSES = [
  "z-20 -rotate-1 translate-y-10 sm:-rotate-2",
  "z-10 rotate-1 translate-y-12 sm:rotate-2",
  "z-0 -rotate-1 translate-y-14 sm:-rotate-3",
] as const;

const EXIT_DURATION = { transitionDuration: `${DECK_EXIT_MS}ms` };

interface DeckStackProps {
  readonly deck: HomeDeck;
  readonly children: ReactNode;
}

function Secondary({ deck }: { readonly deck: HomeDeck }) {
  const { secondary } = deck;
  if (secondary === null) return null;
  return (
    <Card size="sm" className="flex-1">
      <CardContent className="mt-auto flex min-w-0 items-center gap-2">
        <p className="min-w-0 truncate text-sm text-muted-foreground">
          Next #{secondary.rank} {secondary.item.subject}
        </p>
        {secondary.isNew && <Badge variant="secondary">New</Badge>}
      </CardContent>
    </Card>
  );
}

export function DeckStack({ deck, children }: DeckStackProps) {
  const tilts = TILT_CLASSES.slice(0, deck.tilted);
  const exit = deck.leaving
    ? "translate-x-[110%] opacity-0 motion-reduce:translate-x-0"
    : "translate-x-0 opacity-100";

  return (
    <div className={deck.tilted > 0 ? "grid overflow-x-clip pb-14" : "grid overflow-x-clip"}>
      {tilts.map((tilt, index) => (
        <div
          key={tilt}
          aria-hidden={index === 0 ? undefined : true}
          className={`col-start-1 row-start-1 flex ${tilt}`}
        >
          {index === 0 ? <Secondary deck={deck} /> : <Card size="sm" className="flex-1" />}
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
