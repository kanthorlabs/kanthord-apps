import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Fragment, type ReactNode, useEffect, useRef } from "react";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ItemGroup } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";

export type DataListStatus = "loading" | "ready" | "error";

export interface DataListPager {
  readonly hasPrevious: boolean;
  readonly hasNext: boolean;
  readonly position: number;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
}

export interface DataListProps<T> {
  readonly label: string;
  readonly items: readonly T[];
  readonly getKey: (item: T) => string;
  readonly renderItem: (item: T) => ReactNode;
  readonly status: DataListStatus;
  readonly error: string | null;
  readonly pending: boolean;
  readonly onRetry: () => void;
  readonly emptyText: string;
  readonly pager?: DataListPager;
}

export function DataList<T>({
  label,
  items,
  getKey,
  renderItem,
  status,
  error,
  pending,
  onRetry,
  emptyText,
  pager,
}: DataListProps<T>) {
  const region = useFocusOnMove(pager?.position);
  const ready = status === "ready";

  return (
    <section ref={region} aria-label={label} tabIndex={-1} className="flex flex-col gap-4">
      {status === "loading" && <LoadingRows />}

      {status === "error" && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" disabled={pending} onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}

      {ready && error !== null && (
        <Alert variant="destructive">
          <AlertTitle>The page could not be read.</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <AlertAction>
            <Button variant="outline" size="sm" disabled={pending} onClick={onRetry}>
              Retry
            </Button>
          </AlertAction>
        </Alert>
      )}

      {ready && items.length === 0 && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{pager?.hasPrevious === true ? "No more items." : emptyText}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      )}

      {ready && items.length > 0 && (
        <ItemGroup aria-label={label} aria-busy={pending} className="gap-2">
          {items.map((item) => (
            <Fragment key={getKey(item)}>{renderItem(item)}</Fragment>
          ))}
        </ItemGroup>
      )}

      {ready && pager !== undefined && (
        <nav aria-label={`${label} pages`} className="flex justify-between gap-2">
          <Button
            variant="outline"
            disabled={pending || !pager.hasPrevious}
            onClick={pager.onPrevious}
          >
            <ChevronLeftIcon aria-hidden="true" data-icon="inline-start" />
            Previous
          </Button>
          <Button variant="outline" disabled={pending || !pager.hasNext} onClick={pager.onNext}>
            Next
            <ChevronRightIcon aria-hidden="true" data-icon="inline-end" />
          </Button>
        </nav>
      )}
    </section>
  );
}

function useFocusOnMove(position: number | undefined) {
  const region = useRef<HTMLElement>(null);
  const shown = useRef(position);

  useEffect(() => {
    if (position === shown.current) return;
    shown.current = position;
    region.current?.scrollIntoView({ block: "start" });
    region.current?.focus({ preventScroll: true });
  }, [position]);

  return region;
}

function LoadingRows() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}
