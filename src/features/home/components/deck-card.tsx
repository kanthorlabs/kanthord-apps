import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AttentionDetails, AttentionItem } from "@/lib/attention";
import { deckCardTextOf } from "@/lib/deck-card";
import { DECK_GONE_TEXT } from "@/lib/home-deck";

import { useBoardReadsContext } from "../use-board-reads";
import { BoardActBar } from "./board-act-bar";
import { ChangeAskedSection } from "./change-asked";
import { InboxMessage } from "./inbox-message";

interface DeckCardProps {
  readonly item: AttentionItem;
  readonly rank: number;
  readonly details: AttentionDetails;
  readonly now: number;
  readonly held: number;
  readonly gone: boolean;
}

export function DeckCard({ item, rank, details, now, held, gone }: DeckCardProps) {
  const reads = useBoardReadsContext();
  const text = deckCardTextOf(item, details, now, held);

  return (
    <Card size="sm" role="group" aria-label={`Primary: ${item.subject}`}>
      <CardHeader>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Badge variant="secondary">#{rank}</Badge>
          <Badge variant="outline">{text.tab}</Badge>
          {text.projects.map((project) => (
            <Badge key={project.id} variant="outline">
              {project.name}
            </Badge>
          ))}
          <span className="text-sm text-muted-foreground">{text.waiting}</span>
          {text.heldOn !== null && <span className="text-sm">{text.heldOn}</span>}
          {text.label !== null && <Badge variant="outline">{text.label}</Badge>}
        </div>
        <CardTitle className="break-words">{text.title}</CardTitle>
        <CardDescription className="break-words">{text.cause}</CardDescription>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-3 empty:hidden">
        {item.kind === "inbox_item" && (
          <div className="flex min-w-0 flex-col gap-1">
            <InboxMessage item={item} />
          </div>
        )}
        {item.kind === "tool_approval" && <ChangeAskedSection reads={reads} />}
        {gone && (
          <p role="status" className="text-sm text-muted-foreground">
            {DECK_GONE_TEXT}
          </p>
        )}
      </CardContent>
      {!gone && (
        <CardFooter>
          <div className="min-w-0 flex-1">
            <BoardActBar />
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
