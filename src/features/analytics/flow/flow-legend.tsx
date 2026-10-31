import type { FlowLegendEntry } from "@/lib/flow-stages";

interface FlowLegendProps {
  readonly entries: readonly FlowLegendEntry[];
}

const GLYPH_TONE: Readonly<Record<string, string>> = {
  "◐": "text-flow-warn-glyph",
  "■": "text-flow-bad",
};

export function FlowLegend({ entries }: FlowLegendProps) {
  return (
    <ul
      aria-label="Legend"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"
    >
      {entries.map((entry) => (
        <li key={entry.glyph} className="flex items-center gap-1">
          <span aria-hidden="true" className={GLYPH_TONE[entry.glyph]}>
            {entry.glyph}
          </span>
          <span>{entry.label}</span>
        </li>
      ))}
    </ul>
  );
}
