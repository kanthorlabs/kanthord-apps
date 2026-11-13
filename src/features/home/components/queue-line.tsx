import { ListOrderedIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { DeckQueueEntry } from "@/lib/home-deck";

interface QueueLineProps {
  readonly entry: DeckQueueEntry;
  readonly onShow: (itemId: string) => void;
}

export function QueueLine({ entry, onShow }: QueueLineProps) {
  return (
    <p className="flex min-w-0 flex-wrap items-center gap-1 text-sm text-muted-foreground">
      <ListOrderedIcon aria-hidden="true" className="size-4 shrink-0" />
      <span className="min-w-0 break-words">{entry.subject} is</span>{" "}
      <Button
        variant="link"
        size="sm"
        aria-label={`Show #${entry.rank} in the deck`}
        onClick={() => onShow(entry.id)}
      >
        #{entry.rank}
      </Button>{" "}
      <span>in your queue.</span>
    </p>
  );
}
