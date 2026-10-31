import { type KeyboardEvent, useRef, useState } from "react";
import { Link } from "react-router-dom";

import type { StopCell, StopMatrix, StopRow, StopShade } from "@/lib/flow-stop-reasons";

interface StopReasonMatrixProps {
  readonly matrix: StopMatrix;
}

interface Position {
  readonly row: number;
  readonly column: number;
}

interface RowViewProps {
  readonly row: StopRow;
  readonly rowIndex: number;
  readonly active: Position;
  readonly template: string;
  readonly register: (position: Position, element: HTMLAnchorElement | null) => void;
  readonly onFocus: (position: Position) => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLAnchorElement>, position: Position) => void;
}

const SHADE_CLASS: Readonly<Record<StopShade, string>> = {
  seq1: "bg-flow-seq-1 text-foreground dark:text-background",
  seq2: "bg-flow-seq-2 text-foreground dark:text-background",
  seq3: "bg-flow-seq-3 text-foreground dark:text-background",
  seq4: "bg-flow-seq-4 text-background",
  seq5: "bg-flow-seq-5 text-background",
};
const STEPS: Readonly<Record<string, Position>> = {
  ArrowLeft: { row: 0, column: -1 },
  ArrowRight: { row: 0, column: 1 },
  ArrowUp: { row: -1, column: 0 },
  ArrowDown: { row: 1, column: 0 },
};
const FIRST_COLUMN = "sticky left-0 z-10 bg-background pr-2 text-left";
const LINK =
  "flex h-full w-full items-center justify-center rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

function rowsOf(matrix: StopMatrix): readonly StopRow[] {
  return [...matrix.rows, matrix.all, matrix.budget];
}

function linked(rows: readonly StopRow[], position: Position): boolean {
  return rows[position.row]?.cells[position.column]?.target != null;
}

function firstLinked(rows: readonly StopRow[]): Position {
  for (const [row, { cells }] of rows.entries()) {
    const column = cells.findIndex((cell) => cell.target !== null);
    if (column >= 0) return { row, column };
  }
  return { row: 0, column: 0 };
}

function nextLinked(rows: readonly StopRow[], from: Position, step: Position): Position | null {
  const width = rows[0]?.cells.length ?? 0;
  let row = from.row + step.row;
  let column = from.column + step.column;
  while (row >= 0 && row < rows.length && column >= 0 && column < width) {
    if (linked(rows, { row, column })) return { row, column };
    row += step.row;
    column += step.column;
  }
  return null;
}

function CellView({
  cell,
  position,
  active,
  register,
  onFocus,
  onKeyDown,
}: Pick<RowViewProps, "register" | "onFocus" | "onKeyDown"> & {
  readonly cell: StopCell;
  readonly position: Position;
  readonly active: boolean;
}) {
  const shade = cell.shade === null ? "" : SHADE_CLASS[cell.shade];
  return (
    <div role="gridcell" className={`flex h-8 items-center justify-center text-sm ${shade}`}>
      {cell.target === null ? (
        <span role="img" aria-label={String(cell.count)}>
          {cell.text}
        </span>
      ) : (
        <Link
          ref={(element) => register(position, element)}
          to={cell.target}
          aria-label={cell.label}
          tabIndex={active ? 0 : -1}
          onFocus={() => onFocus(position)}
          onKeyDown={(event) => onKeyDown(event, position)}
          className={LINK}
        >
          {cell.text}
        </Link>
      )}
    </div>
  );
}

function RowView({ row, rowIndex, active, template, register, onFocus, onKeyDown }: RowViewProps) {
  return (
    <div
      role="row"
      className={`grid items-center gap-x-1 ${row.bold ? "font-semibold" : ""}`}
      style={{ gridTemplateColumns: template }}
    >
      <div role="rowheader" className={`${FIRST_COLUMN} text-sm break-words`}>
        {row.name}
      </div>
      {row.cells.map((cell, column) => (
        <CellView
          key={column}
          cell={cell}
          position={{ row: rowIndex, column }}
          active={active.row === rowIndex && active.column === column}
          register={register}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
        />
      ))}
      <div role="gridcell" className="text-right text-sm tabular-nums">
        {row.doubled && (
          <>
            <span role="img" aria-label="more than doubled">
              ▲
            </span>{" "}
          </>
        )}
        {row.total}
      </div>
      <div role="gridcell" className="text-right text-sm text-muted-foreground tabular-nums">
        {row.previous}
      </div>
    </div>
  );
}

export function StopReasonMatrix({ matrix }: StopReasonMatrixProps) {
  const rows = rowsOf(matrix);
  const [focused, setFocused] = useState<Position | null>(null);
  const links = useRef(new Map<string, HTMLAnchorElement>());
  const active = focused !== null && linked(rows, focused) ? focused : firstLinked(rows);
  const template = `minmax(9rem,12rem) repeat(${matrix.columns.length}, minmax(2.5rem,1fr)) 4.5rem 4rem`;

  const register = (position: Position, element: HTMLAnchorElement | null) => {
    const key = `${position.row}:${position.column}`;
    if (element === null) links.current.delete(key);
    else links.current.set(key, element);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLAnchorElement>, position: Position) => {
    const step = STEPS[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const next = nextLinked(rows, position, step);
    if (next === null) return;
    setFocused(next);
    links.current.get(`${next.row}:${next.column}`)?.focus();
  };
  const { rows: reasons, all, budget } = matrix;
  const common = { active, template, register, onFocus: setFocused, onKeyDown };

  return (
    <div className="overflow-x-auto">
      <div
        role="grid"
        aria-label="Stop reasons"
        className="flex w-max min-w-full flex-col gap-y-0.5"
      >
        <div
          role="row"
          className="grid items-center gap-x-1 text-xs text-muted-foreground"
          style={{ gridTemplateColumns: template }}
        >
          <div role="columnheader" className={FIRST_COLUMN}>
            {matrix.lead}
          </div>
          {matrix.columns.map((column, index) => (
            <div key={index} role="columnheader" className="text-center">
              {column.label}
              {column.partial && (
                <>
                  {" "}
                  <span role="img" aria-label="partial day">
                    ◔
                  </span>
                </>
              )}
            </div>
          ))}
          <div role="columnheader" className="text-right">
            Total
          </div>
          <div role="columnheader" className="text-right">
            Prev
          </div>
        </div>
        {reasons.map((row, index) => (
          <RowView key={row.name} row={row} rowIndex={index} {...common} />
        ))}
        <RowView row={all} rowIndex={reasons.length} {...common} />
        <div role="row">
          <div role="gridcell" className="border-t pt-1 text-left text-xs text-muted-foreground">
            <span className="sticky left-0">not a failure</span>
          </div>
        </div>
        <RowView row={budget} rowIndex={reasons.length + 1} {...common} />
      </div>
    </div>
  );
}
