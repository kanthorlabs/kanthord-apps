import { RefreshCwIcon } from "lucide-react";

import { ProjectFilter } from "@/components/project-filter";
import { Button } from "@/components/ui/button";
import { ANALYTICS_BUCKET_OPTIONS, ANALYTICS_RANGE_OPTIONS } from "@/lib/analytics-query";

import { FilterSelect } from "../../traces/list/components/filter-select";
import type { AnalyticsView } from "../use-analytics";

type AnalyticsToolbarProps = Pick<
  AnalyticsView,
  "filters" | "projects" | "selectProject" | "selectRange" | "selectBucket" | "refresh"
>;

export function AnalyticsToolbar({
  filters,
  projects,
  selectProject,
  selectRange,
  selectBucket,
  refresh,
}: AnalyticsToolbarProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
      <div className="w-full md:w-56">
        <ProjectFilter projects={projects} value={filters.projectId} onChange={selectProject} />
      </div>
      <div className="w-full md:w-44">
        <FilterSelect
          label="Time range"
          allLabel={null}
          options={ANALYTICS_RANGE_OPTIONS}
          value={filters.range}
          onChange={selectRange}
        />
      </div>
      <div className="w-full md:w-32">
        <FilterSelect
          label="Bucket"
          allLabel={null}
          options={ANALYTICS_BUCKET_OPTIONS}
          value={filters.bucket}
          onChange={selectBucket}
        />
      </div>
      <Button variant="outline" className="w-full md:w-auto" onClick={refresh}>
        <RefreshCwIcon aria-hidden="true" data-icon="inline-start" />
        Refresh
      </Button>
    </div>
  );
}
