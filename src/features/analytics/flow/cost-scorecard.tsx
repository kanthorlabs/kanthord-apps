import { useMemo } from "react";

import type { FlowRead } from "@/api/types";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import type { FlowFilters } from "@/lib/flow-query";
import { frameOf } from "@/lib/flow-status";
import { scorecardOf } from "@/lib/flow-tiles";

import { CostTile } from "./cost-tile";
import { SplitTable } from "./split-table";

interface CostScorecardProps {
  readonly read: FlowRead;
  readonly filters: Pick<FlowFilters, "range" | "split">;
}

const TILE_GRID = "grid grid-cols-2 gap-3 md:grid-cols-4";
const SKELETON_TILES = [0, 1, 2, 3, 4, 5, 6, 7] as const;

export function CostSkeleton() {
  return (
    <div role="status" aria-label="Loading the cost">
      <ul className={TILE_GRID}>
        {SKELETON_TILES.map((tile) => (
          <li key={tile}>
            <Skeleton className="h-36 w-full" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CostScorecard({ read, filters }: CostScorecardProps) {
  const { range, split } = filters;
  const frame = useMemo(() => frameOf(read, range), [read, range]);
  const scorecard = useMemo(() => scorecardOf(read, frame), [read, frame]);
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold">Cost and tokens</h3>
        <p className="text-sm text-muted-foreground">{scorecard.qualifier}</p>
      </div>
      {scorecard.rows.map((row) => (
        <div key={row.name} className="flex flex-col gap-2">
          <h4 className="text-sm font-medium">{row.name}</h4>
          <ul aria-label={`${row.name} tiles`} className={TILE_GRID}>
            {row.tiles.map((tile) => (
              <li key={tile.id} className="min-w-0">
                <CostTile tile={tile} />
              </li>
            ))}
          </ul>
        </div>
      ))}
      {scorecard.noTurns ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No LLM turns in this range.</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <SplitTable read={read} frame={frame} split={split} />
      )}
    </section>
  );
}
