import { useState } from "react";

import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import type { FlowColumn } from "@/lib/flow-stages";

import { StageBands } from "./flow-bands";
import { DayStrip } from "./day-strip";
import { StageBar } from "./stage-bar";
import { StageException, StageHeadline, StageIcon } from "./stage-column";

interface StageRowProps {
  readonly column: FlowColumn;
}

export function StageRow({ column }: StageRowProps) {
  const [open, setOpen] = useState(false);
  return (
    <li className="flex flex-col gap-2 border-b py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <h4 className="truncate text-sm font-medium">{column.name}</h4>
          <StageIcon column={column} />
          <span className="text-xs text-muted-foreground">{column.entered}</span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-expanded={open}
          aria-label={`${column.name} details`}
          onClick={() => setOpen((current) => !current)}
        >
          ▸
        </Button>
      </div>
      <StageHeadline column={column} />
      <StageException column={column} />
      <DayStrip strip={column.strip} />
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <StageBar name={column.name} bar={column.bar} />
        </div>
        <p className="text-xs break-words">{column.exits}</p>
      </div>
      <Reveal open={open}>
        <StageBands column={column} />
      </Reveal>
    </li>
  );
}
