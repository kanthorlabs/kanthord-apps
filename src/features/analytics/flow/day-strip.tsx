import { type KeyboardEvent, useRef, useState } from "react";
import { Link } from "react-router-dom";

import type { FlowDayCell, FlowDayStrip } from "@/lib/flow-stages";

interface DayStripProps {
  readonly strip: FlowDayStrip;
}

interface DayAxisProps {
  readonly cells: readonly FlowDayCell[];
}

const CELL_LAYOUT =
  "relative flex h-8 min-w-0 flex-1 items-center justify-center rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:h-6";
const SEVERITY_FILL = {
  ok: "border border-border bg-muted",
  warn: "bg-flow-warn",
  bad: "bg-flow-bad",
} as const;
const ARROW_STEP: Readonly<Record<string, number>> = { ArrowLeft: -1, ArrowRight: 1 };

function fillOf(cell: FlowDayCell): string {
  if (cell.partial) return "border border-dashed border-foreground";
  if (cell.underSettled) return "border border-dashed border-muted-foreground";
  return SEVERITY_FILL[cell.severity];
}

export function DayStrip({ strip }: DayStripProps) {
  const [active, setActive] = useState(0);
  const links = useRef<(HTMLAnchorElement | null)[]>([]);
  const last = strip.cells.length - 1;

  const move = (event: KeyboardEvent<HTMLAnchorElement>, index: number) => {
    const step = ARROW_STEP[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const next = Math.min(Math.max(index + step, 0), last);
    setActive(next);
    links.current[next]?.focus();
  };

  return (
    <div role="grid" aria-label={strip.metric}>
      <div role="row" className="flex gap-0.5">
        {strip.cells.map((cell, index) => (
          <div key={cell.day} role="gridcell" className="flex min-w-0 flex-1">
            <Link
              ref={(element) => {
                links.current[index] = element;
              }}
              to={cell.target}
              aria-label={cell.label}
              tabIndex={index === active ? 0 : -1}
              onFocus={() => setActive(index)}
              onKeyDown={(event) => move(event, index)}
              className={`${CELL_LAYOUT} ${fillOf(cell)}`}
            >
              {cell.changed && (
                <span aria-hidden="true" className="size-1.5 rounded-full bg-foreground" />
              )}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DayAxis({ cells }: DayAxisProps) {
  const first = cells[0];
  const end = cells.at(-1);
  if (first === undefined || end === undefined) return null;
  const endText = `${end.day.split(" ").slice(1).join(" ")}${end.partial ? " ◔" : ""}`;
  return (
    <div className="flex justify-between text-xs text-muted-foreground">
      <span>{first.day}</span>
      <span>{endText}</span>
    </div>
  );
}
