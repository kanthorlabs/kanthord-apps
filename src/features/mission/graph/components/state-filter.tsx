import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { FILTER_STATES, type FilterState } from "../use-mission-graph";

interface StateFilterProps {
  readonly activeStates: ReadonlySet<FilterState>;
  readonly stateCounts: ReadonlyMap<FilterState, number>;
  readonly onSelectStates: (values: readonly string[]) => void;
  readonly titleFilter: string;
  readonly onTitleFilter: (v: string) => void;
}

export function StateFilter({
  activeStates,
  stateCounts,
  onSelectStates,
  titleFilter,
  onTitleFilter,
}: StateFilterProps) {
  return (
    <div className="flex flex-col gap-3">
      <Input
        type="search"
        aria-label="Filter by title"
        placeholder="Filter by title"
        value={titleFilter}
        onChange={(e) => onTitleFilter(e.target.value)}
      />
      <ToggleGroup
        multiple
        variant="outline"
        size="sm"
        spacing={2}
        aria-label="Filter by state"
        value={[...activeStates]}
        onValueChange={onSelectStates}
        className="flex-wrap"
      >
        {FILTER_STATES.map((s) => {
          const count = stateCounts.get(s) ?? 0;
          if (count === 0) return null;
          return (
            <ToggleGroupItem key={s} value={s}>
              {s}
              <span className="tabular-nums">({count})</span>
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
    </div>
  );
}
