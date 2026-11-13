import type { ReactNode } from "react";

import { TouchTarget } from "@/components/touch-target";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { DetailRead } from "@/lib/attention";

export type BoardReadName =
  | "the session"
  | "the assessment"
  | "the proposals"
  | "the evidence"
  | "the discard reason"
  | "the execution trace";

interface BoardReadBlockProps<T> {
  readonly name: BoardReadName;
  readonly read: DetailRead<T> | null;
  readonly onRetry: () => void;
  readonly children: (data: T) => ReactNode;
}

export function BoardReadBlock<T>({ name, read, onRetry, children }: BoardReadBlockProps<T>) {
  if (read === null) {
    return (
      <div className="flex flex-col gap-2">
        <span className="sr-only">Reading {name}.</span>
        <Skeleton className="h-4 w-full max-w-[80ch]" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }
  if (read.status === "failed") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-destructive">Could not read {name}.</p>
        <TouchTarget>
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </TouchTarget>
      </div>
    );
  }
  return <>{children(read.data)}</>;
}
