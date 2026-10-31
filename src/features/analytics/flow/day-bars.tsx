import { costText } from "@/lib/flow-format";

interface DayBarsProps {
  readonly values: readonly number[];
  readonly scale: number;
  readonly partial: boolean;
  readonly label: string;
}

const WIDTH = 80;
const HEIGHT = 24;
const GAP = 2;
const FADED = 0.35;

function nameOf(values: readonly number[], label: string): string {
  if (values.length === 0) return `Daily cost of ${label} has no values`;
  const range = `from ${costText(Math.min(...values))} to ${costText(Math.max(...values))}`;
  return `Daily cost of ${label} ${range}`;
}

export function DayBars({ values, scale, partial, label }: DayBarsProps) {
  const slot = WIDTH / Math.max(values.length, 1);
  return (
    <svg
      role="img"
      aria-label={nameOf(values, label)}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-6 w-20 max-w-full"
    >
      {values.map((value, index) => {
        const height = scale > 0 ? (value / scale) * HEIGHT : 0;
        const faded = partial && index === values.length - 1;
        return (
          <rect
            key={`day-${index}`}
            x={index * slot}
            y={HEIGHT - height}
            width={slot - GAP}
            height={height}
            fillOpacity={faded ? FADED : 1}
            className="fill-foreground"
            aria-label={faded ? "Partial bucket" : undefined}
          />
        );
      })}
    </svg>
  );
}
