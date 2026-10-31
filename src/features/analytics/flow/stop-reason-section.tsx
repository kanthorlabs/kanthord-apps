import { useMemo } from "react";

import type { FlowRead } from "@/api/types";
import { Skeleton } from "@/components/ui/skeleton";
import type { FlowFilters } from "@/lib/flow-query";
import { frameOf } from "@/lib/flow-status";
import { stopMatrixOf } from "@/lib/flow-stop-reasons";

import { StopReasonMatrix } from "./stop-reason-matrix";

interface StopReasonSectionProps {
  readonly read: FlowRead;
  readonly filters: Pick<FlowFilters, "range">;
}

export function StopReasonSkeleton() {
  return <Skeleton role="status" aria-label="Loading the stop reasons" className="h-64 w-full" />;
}

export function StopReasonSection({ read, filters }: StopReasonSectionProps) {
  const matrix = useMemo(
    () => stopMatrixOf(read, frameOf(read, filters.range)),
    [read, filters.range],
  );
  return (
    <section className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold">{matrix.heading}</h3>
        <p className="text-sm text-muted-foreground">{matrix.summary}</p>
      </div>
      <StopReasonMatrix matrix={matrix} />
      <p className="text-xs text-muted-foreground">{matrix.reconciliation}</p>
    </section>
  );
}
