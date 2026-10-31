import { Skeleton } from "@/components/ui/skeleton";
import { BOARD_TABS } from "@/lib/board-tabs";
import { BOARD_WIDTH, type BoardWidth } from "@/lib/board-width";

interface BoardSkeletonProps {
  readonly widthClass: BoardWidth;
}

const CARDS = ["first", "second", "third"];

export function BoardSkeleton({ widthClass }: BoardSkeletonProps) {
  const expanded = widthClass === BOARD_WIDTH.Expanded;
  return (
    <section
      aria-label="Loading the board"
      aria-busy="true"
      className={
        expanded
          ? "grid grid-cols-[minmax(400px,1fr)_minmax(544px,740px)] gap-4"
          : "flex flex-col gap-4"
      }
    >
      <div className="flex min-w-0 flex-col gap-3">
        <div className="grid grid-cols-6 gap-1">
          {BOARD_TABS.map((tab) => (
            <Skeleton key={tab.id} className="h-9" />
          ))}
        </div>
        {CARDS.map((card) => (
          <Skeleton key={card} className="h-24" />
        ))}
      </div>
      {expanded && <Skeleton className="h-96" />}
    </section>
  );
}
