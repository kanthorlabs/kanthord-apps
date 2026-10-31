import { Link } from "react-router-dom";

import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import type { CauseRow, ParetoModel } from "@/lib/flow-causes";

interface ParetoRowsProps {
  readonly model: ParetoModel;
  readonly open: string | null;
  readonly truncated: boolean;
  readonly onToggle: (category: string) => void;
}

interface CauseRowViewProps {
  readonly row: CauseRow;
  readonly open: boolean;
  readonly hatched: boolean;
  readonly onToggle: (category: string) => void;
}

const COLUMNS =
  "grid grid-cols-[minmax(9rem,1.2fr)_minmax(10rem,2fr)_7.5rem_5rem_4rem_4.5rem_6.5rem] items-center gap-x-3";
const HEADERS = ["Cause", "Count and bar", "Suspected", "Cost", "Prev", "Cum %"] as const;
const NUMBER = "text-right tabular-nums";

function CountCell({ row, hatched }: Pick<CauseRowViewProps, "row" | "hatched">) {
  return (
    <div role="cell" className="flex items-center gap-2">
      <span className={`w-14 shrink-0 ${NUMBER}`}>
        {row.doubled && (
          <>
            <span role="img" aria-label="more than doubled">
              ▲
            </span>{" "}
          </>
        )}
        {row.countText}
      </span>
      <div className="h-2 min-w-0 flex-1">
        <div
          className={`h-full rounded-sm ${hatched ? "bg-flow-hatch" : "bg-muted-foreground"}`}
          style={{ width: `${row.bar * 100}%` }}
        />
      </div>
    </div>
  );
}

function CauseName({ row, open, onToggle }: Omit<CauseRowViewProps, "hatched">) {
  if (row.details.length === 0 || row.key === "") {
    return <span className="break-words">{row.name}</span>;
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-expanded={open}
      onClick={() => onToggle(row.key)}
      className="max-w-full justify-start whitespace-normal"
    >
      {`▸ ${row.name}`}
    </Button>
  );
}

function CauseRowView({ row, open, hatched, onToggle }: CauseRowViewProps) {
  return (
    <>
      <div role="row" className={`${COLUMNS} py-1 ${hatched ? "border-t" : ""}`}>
        <div role="rowheader" className="min-w-0 text-sm">
          <CauseName row={row} open={open} onToggle={onToggle} />
        </div>
        <CountCell row={row} hatched={hatched} />
        <div role="cell" className="text-sm text-muted-foreground">
          {row.suspectedText}
        </div>
        <div role="cell" className={`text-sm ${NUMBER}`}>
          {row.costText}
        </div>
        <div role="cell" className={`text-sm ${NUMBER}`}>
          {row.previousText}
        </div>
        <div role="cell" className={`text-sm ${NUMBER}`}>
          {row.cumulativeText}
        </div>
        <div role="cell" className="text-sm">
          {row.target !== null && (
            <Link
              to={row.target}
              aria-label={`Traces of ${row.name}`}
              className="underline underline-offset-4"
            >
              Traces →
            </Link>
          )}
        </div>
      </div>
      {row.details.length > 0 && (
        <div role="row">
          <div role="cell">
            <Reveal open={open}>
              <ul aria-label={`Details of ${row.name}`} className="flex flex-col gap-1 pb-2 pl-6">
                {row.details.map((detail) => (
                  <li key={detail.name} className="flex flex-wrap gap-x-3 text-xs">
                    <span>{detail.name}</span>
                    <span className="tabular-nums">{detail.count}</span>
                    <span className="text-muted-foreground">{detail.assigners}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      )}
    </>
  );
}

export function ParetoRows({ model, open, truncated, onToggle }: ParetoRowsProps) {
  const { rows, unattributed } = model;
  return (
    <div className="flex flex-col gap-2">
      {model.caused === 0 ? (
        <p className="text-sm text-muted-foreground">No failures in this range.</p>
      ) : (
        <div className="overflow-x-auto">
          <div role="table" aria-label="Causes" className="min-w-[46rem]">
            <div role="row" className={`${COLUMNS} pb-1 text-xs text-muted-foreground`}>
              {HEADERS.map((header) => (
                <div key={header} role="columnheader" className="text-left font-medium">
                  {header}
                </div>
              ))}
              <div role="columnheader" className="sr-only">
                Traces
              </div>
            </div>
            {rows.map((row) => (
              <CauseRowView
                key={row.key}
                row={row}
                open={open === row.key}
                hatched={false}
                onToggle={onToggle}
              />
            ))}
            {unattributed !== null && (
              <CauseRowView row={unattributed} open={false} hatched onToggle={onToggle} />
            )}
          </div>
        </div>
      )}
      {truncated && (
        <p className="text-sm text-muted-foreground">
          More cause rows exist. Narrow the range or the filter.
        </p>
      )}
    </div>
  );
}
