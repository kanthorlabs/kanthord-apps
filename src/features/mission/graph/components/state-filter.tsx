import type { NodeState } from "@/api/types";
import { stateClasses } from "@/lib/node-state";

import type { FilterState } from "../use-mission-graph";

const ALL_FILTER_STATES: FilterState[] = [
  "Pending",
  "Available",
  "Executing",
  "Waiting",
  "Evaluating",
  "Blocked",
  "Paused",
  "Completed",
  "Discarded",
  "External.Requested",
  "External.Success",
  "External.Failed",
  "task",
];

function labelFor(s: FilterState): string {
  return s === "task" ? "task" : s;
}

function classesFor(s: FilterState): string {
  if (s === "task") return "border-border bg-muted text-muted-foreground";
  return stateClasses(s as NodeState);
}

interface StateFilterProps {
  readonly activeStates: ReadonlySet<FilterState>;
  readonly stateCounts: ReadonlyMap<FilterState, number>;
  readonly onToggle: (s: FilterState) => void;
  readonly titleFilter: string;
  readonly onTitleFilter: (v: string) => void;
}

export function StateFilter({
  activeStates,
  stateCounts,
  onToggle,
  titleFilter,
  onTitleFilter,
}: StateFilterProps) {
  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        aria-label="Filter by title"
        placeholder="Filter by title"
        value={titleFilter}
        onChange={(e) => onTitleFilter(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by state">
        {ALL_FILTER_STATES.map((s) => {
          const count = stateCounts.get(s) ?? 0;
          if (count === 0) return null;
          const active = activeStates.has(s);
          return (
            <button
              key={s}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(s)}
              className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium transition-opacity ${classesFor(s)} ${active ? "opacity-100 ring-2 ring-ring" : "opacity-60 hover:opacity-80"}`}
            >
              {labelFor(s)}
              <span className="tabular-nums">({count})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
