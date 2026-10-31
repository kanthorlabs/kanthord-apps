import {
  DEFAULT_TIME_RANGE,
  TIME_RANGE_LABELS,
  type TimeWindow,
  windowLabelOf,
} from "@/lib/trace-query";

import { type FilterOption, FilterSelect } from "./filter-select";

const WINDOW_VALUE = "window";

const RANGE_OPTIONS: readonly FilterOption[] = Object.entries(TIME_RANGE_LABELS).map(
  ([value, label]) => ({ value, label }),
);

function rangeOptionsOf(window: TimeWindow | null): readonly FilterOption[] {
  if (window === null) return RANGE_OPTIONS;
  return [{ value: WINDOW_VALUE, label: windowLabelOf(window) }, ...RANGE_OPTIONS];
}

interface RangeFilterProps {
  readonly value: string | null;
  readonly window: TimeWindow | null;
  readonly onChange: (value: string | null) => void;
}

export function RangeFilter({ value, window, onChange }: RangeFilterProps) {
  return (
    <FilterSelect
      label="Time range"
      allLabel={null}
      options={rangeOptionsOf(window)}
      value={window === null ? (value ?? DEFAULT_TIME_RANGE) : WINDOW_VALUE}
      onChange={(next) => {
        if (next !== null) onChange(next);
      }}
    />
  );
}
