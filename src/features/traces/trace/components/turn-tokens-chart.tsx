import type { TurnTokenRow } from "@/lib/turn-token-rows";

interface TurnTokensChartProps {
  readonly rows: readonly TurnTokenRow[];
}

export function TurnTokensChart({ rows }: TurnTokensChartProps) {
  return (
    <ul aria-label="Input tokens per turn" className="flex min-w-0 flex-col gap-1 text-sm">
      {rows.map((row) => (
        <li
          key={row.spanId}
          aria-current={row.selected ? "true" : undefined}
          className="flex min-w-0 items-center gap-2"
        >
          <span className="w-8 shrink-0 text-right tabular-nums">{row.index}</span>
          <div
            aria-hidden="true"
            className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
          >
            <div
              className={`h-full rounded-full ${row.selected ? "bg-primary" : "bg-muted-foreground"}`}
              style={{ width: `${row.percent}%` }}
            />
          </div>
          <span className="shrink-0 tabular-nums">{row.tokens}</span>
          {row.selected && <span className="shrink-0 text-muted-foreground">This turn</span>}
        </li>
      ))}
    </ul>
  );
}
