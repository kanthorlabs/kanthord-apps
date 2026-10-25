import { DataList } from "@/components/data-list";
import { DataListItem } from "@/components/data-list-item";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ItemGroup } from "@/components/ui/item";
import { COST_GROUP_OPTIONS } from "@/lib/analytics-query";

import { FilterSelect } from "../../traces/list/components/filter-select";
import type { AnalyticsView } from "../use-analytics";
import { useCost } from "../use-cost";
import { CostRow } from "./cost-row";

type CostSectionProps = Pick<AnalyticsView, "filters" | "projects" | "refreshCount">;

export function CostSection({ filters, projects, refreshCount }: CostSectionProps) {
  const cost = useCost(filters, refreshCount, projects);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-base font-semibold">Cost</h3>
      <div className="w-full md:w-48">
        <FilterSelect
          label="Group by"
          allLabel={null}
          options={COST_GROUP_OPTIONS}
          value={cost.group}
          onChange={cost.selectGroup}
        />
      </div>
      {cost.status === "ready" && cost.rows.length > 0 && cost.totals !== null && (
        <ItemGroup aria-label="Cost totals">
          <DataListItem title="Total" fields={cost.totals} />
        </ItemGroup>
      )}
      {cost.truncated && (
        <Alert>
          <AlertDescription>
            The range holds more groups. Narrow the range or the filter.
          </AlertDescription>
        </Alert>
      )}
      <DataList
        label="Cost"
        items={cost.rows}
        getKey={(row) => row.key}
        renderItem={(row) => <CostRow row={row} />}
        status={cost.status}
        error={cost.error}
        pending={false}
        onRetry={cost.retry}
        emptyText="No spans in this range."
      />
    </div>
  );
}
