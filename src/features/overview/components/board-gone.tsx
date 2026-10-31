import type { Ref } from "react";

import { TouchTarget } from "@/components/touch-target";
import { Button } from "@/components/ui/button";

interface BoardGoneProps {
  readonly subject: string | null;
  readonly hasNext: boolean;
  readonly onNext: () => void;
  readonly titleId: string;
  readonly titleRef: Ref<HTMLHeadingElement>;
}

export function BoardGone({ subject, hasNext, onNext, titleId, titleRef }: BoardGoneProps) {
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3">
      <h3 id={titleId} ref={titleRef} tabIndex={-1} className="text-base font-semibold">
        This item no longer waits
      </h3>
      <p className="max-w-[80ch] text-sm break-words">
        {subject === null
          ? "The link points to an item that does not wait now."
          : `${subject} left the list at the last refresh. An act elsewhere or a change outside KanthorD resolved it.`}
      </p>
      {hasNext && (
        <div>
          <TouchTarget>
            <Button variant="outline" size="sm" onClick={onNext}>
              Next card
            </Button>
          </TouchTarget>
        </div>
      )}
    </section>
  );
}
