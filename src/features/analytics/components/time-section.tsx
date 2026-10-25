import { DataList } from "@/components/data-list";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TIME_GROUP_OPTIONS, TIME_MEASURE_OPTIONS } from "@/lib/analytics-query";

import { FilterSelect } from "../../traces/list/components/filter-select";
import type { AnalyticsView } from "../use-analytics";
import { useTime } from "../use-time";
import { TimeRow } from "./time-row";

type TimeSectionProps = Pick<AnalyticsView, "filters" | "projects" | "refreshCount">;

export function TimeSection({ filters, projects, refreshCount }: TimeSectionProps) {
  const time = useTime(filters, refreshCount, projects);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-base font-semibold">Time</h3>
      <div className="flex flex-col gap-3 md:flex-row">
        <div className="w-full md:w-48">
          <FilterSelect
            label="Measure"
            allLabel={null}
            options={TIME_MEASURE_OPTIONS}
            value={time.measure}
            onChange={time.selectMeasure}
          />
        </div>
        <div className="w-full md:w-48">
          <FilterSelect
            label="Time group by"
            allLabel={null}
            options={TIME_GROUP_OPTIONS}
            value={time.group}
            onChange={time.selectGroup}
          />
        </div>
      </div>
      {time.truncated && (
        <Alert>
          <AlertDescription>
            The range holds more groups. Narrow the range or the filter.
          </AlertDescription>
        </Alert>
      )}
      <DataList
        label="Time"
        items={time.rows}
        getKey={(row) => row.key}
        renderItem={(row) => <TimeRow row={row} />}
        status={time.status}
        error={time.error}
        pending={false}
        onRetry={time.retry}
        emptyText="No spans in this range."
      />
    </div>
  );
}
