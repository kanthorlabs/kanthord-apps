import type { FlowSeverity } from "@/lib/flow-status";

type Values = readonly (number | null)[];

export interface SparklineSlice {
  readonly key: string;
  readonly values: Values;
  readonly severity: FlowSeverity;
}

interface SparklineProps {
  readonly values: Values;
  readonly partial: boolean;
  readonly warn?: number | null;
  readonly bad?: number | null;
  readonly label: string;
  readonly slice?: SparklineSlice;
  readonly format?: (value: number) => string;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

interface Drawn {
  readonly solid: string;
  readonly dashed: string | null;
  readonly last: Point | null;
}

const WIDTH = 160;
const HEIGHT = 32;
const PAD_X = 4;
const PAD_Y = 4;

const STROKE: Readonly<Record<FlowSeverity, string>> = {
  ok: "stroke-foreground",
  warn: "stroke-flow-warn",
  bad: "stroke-flow-bad",
};

function plainText(value: number): string {
  return String(Number(value.toPrecision(3)));
}

function numbersOf(values: Values): readonly number[] {
  return values.filter((value): value is number => value !== null);
}

function drawn(values: Values, partial: boolean, y: (value: number) => number): Drawn {
  const count = values.length;
  const x = (index: number) =>
    count <= 1 ? WIDTH / 2 : PAD_X + (index * (WIDTH - 2 * PAD_X)) / (count - 1);
  const pointAt = (index: number): Point | null => {
    const value = values[index];
    return value === null || value === undefined ? null : { x: x(index), y: y(value) };
  };
  const solidEnd = partial ? count - 2 : count - 1;
  let solid = "";
  let pen = "M";
  for (let index = 0; index <= solidEnd; index += 1) {
    const point = pointAt(index);
    if (point === null) {
      pen = "M";
      continue;
    }
    solid += `${pen}${point.x.toFixed(1)} ${point.y.toFixed(1)} `;
    pen = "L";
  }
  const from = partial ? pointAt(count - 2) : null;
  const last = pointAt(count - 1);
  const dashed =
    from === null || last === null
      ? null
      : `M${from.x.toFixed(1)} ${from.y.toFixed(1)} L${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  return { solid: solid.trim(), dashed, last };
}

interface LineProps {
  readonly values: Values;
  readonly partial: boolean;
  readonly y: (value: number) => number;
  readonly stroke: string;
  readonly endLabel?: string;
}

function Line({ values, partial, y, stroke, endLabel }: LineProps) {
  const { solid, dashed, last } = drawn(values, partial, y);
  return (
    <g>
      <path d={solid} fill="none" strokeWidth={1.5} className={stroke} />
      {dashed === null ? null : (
        <path
          d={dashed}
          fill="none"
          strokeWidth={1.5}
          strokeDasharray="3 3"
          className={stroke}
          aria-label="Partial bucket"
        />
      )}
      {last === null ? null : (
        <circle
          cx={last.x}
          cy={last.y}
          r={2.5}
          strokeWidth={1.5}
          fill={partial ? "none" : undefined}
          className={partial ? stroke : `${stroke} fill-foreground`}
          aria-label={partial ? "Last point, partial bucket" : undefined}
        />
      )}
      {endLabel === undefined || last === null ? null : (
        <text x={last.x - 4} y={last.y - 5} textAnchor="end" className="fill-foreground text-[8px]">
          {endLabel}
        </text>
      )}
    </g>
  );
}

function nameOf(
  label: string,
  numbers: readonly number[],
  bounds: readonly (readonly [string, number])[],
  format: (value: number) => string,
): string {
  if (numbers.length === 0) return `Daily ${label} has no values`;
  const range = `Daily ${label} from ${format(Math.min(...numbers))} to ${format(Math.max(...numbers))}`;
  return [range, ...bounds.map(([name, value]) => `${name} line ${format(value)}`)].join(", ");
}

export function Sparkline({
  values,
  partial,
  warn = null,
  bad = null,
  label,
  slice,
  format = plainText,
}: SparklineProps) {
  const bounds = [
    ...(warn === null ? [] : [["warn", warn] as const]),
    ...(bad === null ? [] : [["bad", bad] as const]),
  ];
  const numbers = numbersOf(values);
  const spread = [...numbers, ...numbersOf(slice?.values ?? []), ...bounds.map(([, v]) => v)];
  const low = Math.min(...spread);
  const high = Math.max(...spread);
  const y = (value: number) =>
    high === low ? HEIGHT / 2 : PAD_Y + (1 - (value - low) / (high - low)) * (HEIGHT - 2 * PAD_Y);
  return (
    <svg
      role="img"
      aria-label={nameOf(label, numbers, bounds, format)}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-8 w-40 max-w-full"
    >
      {warn === null ? null : (
        <line
          x1={0}
          x2={WIDTH}
          y1={y(warn)}
          y2={y(warn)}
          strokeWidth={1}
          strokeDasharray="4 3"
          className="stroke-flow-warn"
          aria-label={`warn line ${format(warn)}`}
        />
      )}
      {bad === null ? null : (
        <line
          x1={0}
          x2={WIDTH}
          y1={y(bad)}
          y2={y(bad)}
          strokeWidth={1}
          strokeDasharray="1 3"
          className="stroke-flow-bad"
          aria-label={`bad line ${format(bad)}`}
        />
      )}
      <Line
        values={values}
        partial={partial}
        y={y}
        stroke={slice === undefined ? "stroke-foreground" : "stroke-muted-foreground"}
      />
      {slice === undefined ? null : (
        <Line
          values={slice.values}
          partial={partial}
          y={y}
          stroke={STROKE[slice.severity]}
          endLabel={slice.key}
        />
      )}
    </svg>
  );
}
