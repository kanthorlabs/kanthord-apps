import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import { DECK_EXIT_MS, type HomeDeck } from "../use-home-deck";

const TILT_CLASSES = [
  "z-20 origin-[50%_120%] [transform:translateY(-26px)_rotate(2deg)]",
  "z-10 origin-[50%_120%] [transform:translateY(-16px)_rotate(-3deg)] sm:[transform:translateY(-14px)_rotate(-3deg)]",
  "z-0 origin-[50%_120%] [transform:translateY(-15px)_rotate(-4deg)] sm:[transform:translateY(-8px)_rotate(-5deg)]",
] as const;

const EXIT_DURATION = { transitionDuration: `${DECK_EXIT_MS}ms` };

interface DeckStackProps {
  readonly deck: HomeDeck;
  readonly children: ReactNode;
}

interface SecondaryProps {
  readonly deck: HomeDeck;
}

function Secondary({ deck }: SecondaryProps) {
  const { secondary } = deck;
  if (secondary === null) return null;
  return (
    <Card size="sm" className="flex-1 gap-0 py-0">
      <CardContent className="flex min-w-0 flex-row items-center gap-2 py-0.5">
        <p className="min-w-0 truncate text-sm text-muted-foreground">
          Next #{secondary.rank} {secondary.item.subject}
        </p>
        <Badge variant="outline">{secondary.tab}</Badge>
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

  const room = deck.tilted > 0 ? "pt-[34px] pb-2 sm:pt-10 sm:pb-[26px]" : "";

  return (
    <div className={`isolate grid grid-cols-[minmax(0,1fr)] ${room}`}>
      {tilts.map((tilt, index) => (
        <div
          key={tilt}
          aria-hidden={index === 0 ? undefined : true}
          className={`col-start-1 row-start-1 flex ${tilt}`}
        >
          {index === 0 ? (
            <Secondary deck={deck} />
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
