import { DEFAULT_TIME_RANGE, TIME_RANGE_LABELS } from "@/lib/trace-query";

import { FilterSelect, type FilterOption } from "./filter-select";

const RANGE_OPTIONS: readonly FilterOption[] = Object.entries(TIME_RANGE_LABELS).map(
  ([value, label]) => ({ value, label }),
);

interface RangeFilterProps {
  readonly value: string | null;
  readonly onChange: (value: string | null) => void;
}

export function RangeFilter({ value, onChange }: RangeFilterProps) {
  return (
    <FilterSelect
      label="Time range"
      allLabel={null}
      options={RANGE_OPTIONS}
      value={value ?? DEFAULT_TIME_RANGE}
      onChange={onChange}
    />
  );
}
