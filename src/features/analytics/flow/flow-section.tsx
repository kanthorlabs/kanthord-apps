import { Fragment, useMemo, useState } from "react";

import { useIsMobile } from "@/hooks/use-mobile";
import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import type { FlowRead } from "@/api/types";
import { type FlowModel, flowOf } from "@/lib/flow-stages";
import type { FlowFilters } from "@/lib/flow-query";
import { frameOf } from "@/lib/flow-status";

import { FlowBandRows } from "./flow-bands";
import { FlowLegend } from "./flow-legend";
import { StageColumn } from "./stage-column";
import { StageRow } from "./stage-row";

interface FlowSectionProps {
  readonly read: FlowRead;
  readonly filters: Pick<FlowFilters, "range" | "projectId" | "workerName">;
}

interface ColumnsProps {
  readonly model: FlowModel;
  readonly open: boolean;
}

const GRID =
  "grid grid-cols-[minmax(0,1fr)_1.25rem_minmax(0,1fr)_1.25rem_minmax(0,1fr)_1.25rem_minmax(0,1fr)_1.25rem_minmax(0,1fr)_1.25rem_minmax(0,1fr)]";

function Separator({ handOff }: { readonly handOff: boolean }) {
  if (!handOff) {
    return (
      <div aria-hidden="true" className="flex justify-center pt-1 text-muted-foreground">
        ›
      </div>
    );
  }
  return (
    <div className="flex justify-center border-l border-dashed text-[10px] text-muted-foreground [writing-mode:vertical-rl]">
      hand-off
    </div>
  );
}

function WideColumns({ model, open }: ColumnsProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className={GRID}>
        {model.columns.map((column, index) => (
          <Fragment key={column.stage}>
            {index > 0 && <Separator handOff={column.stage === "evaluation"} />}
            <StageColumn column={column} showAxis={column.stage === "queued"} />
          </Fragment>
        ))}
      </div>
      {model.loops !== null && <p className="text-xs text-muted-foreground">{model.loops}</p>}
      <Reveal open={open}>
        <FlowBandRows columns={model.columns} gridClassName={GRID} />
      </Reveal>
    </div>
  );
}

function NarrowRows({ model }: Pick<ColumnsProps, "model">) {
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col">
        {model.columns.map((column) => (
          <StageRow key={column.stage} column={column} />
        ))}
      </ol>
      {model.loops !== null && <p className="text-xs text-muted-foreground">{model.loops}</p>}
    </div>
  );
}

export function FlowSection({ read, filters }: FlowSectionProps) {
  const [open, setOpen] = useState(false);
  const mobile = useIsMobile();
  const { range, projectId, workerName } = filters;
  const model = useMemo(
    () => flowOf(read, frameOf(read, range), { projectId, workerName }),
    [read, range, projectId, workerName],
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold">Flow</h3>
        <div className="flex flex-wrap items-center gap-3">
          <FlowLegend entries={model.legend} />
          {!mobile && (
            <Button
              variant="outline"
              size="sm"
              aria-expanded={open}
              onClick={() => setOpen((current) => !current)}
            >
              Details ▾
            </Button>
          )}
        </div>
      </div>
      {mobile ? <NarrowRows model={model} /> : <WideColumns model={model} open={open} />}
    </section>
  );
}
