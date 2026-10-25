import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { TouchTarget } from "@/components/touch-target";
import { Button } from "@/components/ui/button";
import type { ErrorNeighbours } from "@/lib/error-trail";

import type { ConversationLink } from "../use-span-detail";

interface SpanFooterProps {
  readonly errors: ErrorNeighbours;
  readonly conversationLink: ConversationLink | null;
  readonly onSelect: (spanId: string) => void;
  readonly onOpenConversation: (link: ConversationLink) => void;
}

export function SpanFooter({
  errors,
  conversationLink,
  onSelect,
  onOpenConversation,
}: SpanFooterProps) {
  const { previous, next } = errors;
  return (
    <div className="sticky bottom-0 z-10 flex min-w-0 flex-wrap items-center justify-between gap-2 border-t bg-background py-2">
      <TouchTarget>
        <Button
          variant="outline"
          size="sm"
          disabled={previous === null}
          onClick={() => previous !== null && onSelect(previous)}
        >
          <ChevronLeftIcon aria-hidden="true" data-icon="inline-start" />
          Previous error
        </Button>
      </TouchTarget>
      {conversationLink !== null && (
        <TouchTarget>
          <Button variant="outline" size="sm" onClick={() => onOpenConversation(conversationLink)}>
            Conversation
          </Button>
        </TouchTarget>
      )}
      <TouchTarget>
        <Button
          variant="outline"
          size="sm"
          disabled={next === null}
          onClick={() => next !== null && onSelect(next)}
        >
          Next error
          <ChevronRightIcon aria-hidden="true" data-icon="inline-end" />
        </Button>
      </TouchTarget>
    </div>
  );
}
