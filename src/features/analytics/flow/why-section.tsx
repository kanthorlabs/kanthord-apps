import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Checkbox } from "@/components/ui/checkbox";
import { FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TouchTarget } from "@/components/touch-target";
import type { FlowRead } from "@/api/types";
import { useIsMobile } from "@/hooks/use-mobile";
import { paretoOf, unattributedOf } from "@/lib/flow-causes";
import { countText } from "@/lib/flow-format";
import { FLOW_FILTER_STAGES, type FlowFilters } from "@/lib/flow-query";
import { frameOf } from "@/lib/flow-status";
import { withParam } from "@/lib/trace-query";

import { FilterSelect } from "../../traces/list/components/filter-select";
import { ParetoRows } from "./pareto-rows";
import { UnattributedPanel } from "./unattributed-panel";

interface WhySectionProps {
  readonly read: FlowRead;
  readonly filters: Pick<FlowFilters, "range" | "projectId" | "workerName" | "stage" | "cause">;
}

const ALL_STAGES = "all";
const BUDGET_CHECKBOX = "why-include-budget";
const STAGE_OPTIONS = FLOW_FILTER_STAGES.map((stage) => {
  const words = stage.replace("_", " ");
  return { value: stage, label: `${words.charAt(0).toUpperCase()}${words.slice(1)}` };
});

export function WhySkeleton() {
  return (
    <div role="status" aria-label="Loading the causes" className="grid gap-4 md:grid-cols-3">
      <Skeleton className="h-64 w-full md:col-span-2" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export function WhySection({ read, filters }: WhySectionProps) {
  const [, setParams] = useSearchParams();
  const [includeBudget, setIncludeBudget] = useState(false);
  const mobile = useIsMobile();
  const { range, projectId, workerName, stage, cause } = filters;
  const pareto = useMemo(
    () => paretoOf(read, { stage, includeBudget, scope: { projectId, workerName } }),
    [read, stage, includeBudget, projectId, workerName],
  );
  const panel = useMemo(() => unattributedOf(read, frameOf(read, range)), [read, range]);

  const write = (key: string, value: string | null) =>
    setParams((current) => withParam(current, key, value), {
      replace: true,
      preventScrollReset: true,
    });
  const selectStage = (value: string | null) => write("stage", value === ALL_STAGES ? null : value);
  const toggleCause = (category: string) => write("cause", cause === category ? null : category);

  const paretoView = (
    <div className="min-w-0 md:col-span-2">
      <ParetoRows
        model={pareto}
        open={cause}
        truncated={read.causes.truncated}
        onToggle={toggleCause}
      />
    </div>
  );
  const panelView = (
    <div className="min-w-0">
      <UnattributedPanel model={panel} />
    </div>
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold">
          Why{" "}
          <span className="font-normal text-muted-foreground">
            {`${countText(pareto.caused)} caused executions`}
          </span>
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          {mobile ? (
            <div className="w-40">
              <FilterSelect
                label="Stage"
                allLabel="All"
                options={STAGE_OPTIONS}
                value={stage}
                onChange={selectStage}
              />
            </div>
          ) : (
            <ToggleGroup
              aria-label="Stage"
              variant="outline"
              value={[stage ?? ALL_STAGES]}
              onValueChange={(next) => {
                const [value] = next;
                if (value !== undefined) selectStage(value);
              }}
            >
              {[{ value: ALL_STAGES, label: "All" }, ...STAGE_OPTIONS].map((option) => (
                <TouchTarget key={option.value}>
                  <ToggleGroupItem value={option.value}>{option.label}</ToggleGroupItem>
                </TouchTarget>
              ))}
            </ToggleGroup>
          )}
          <div className="flex items-center gap-2">
            <Checkbox
              id={BUDGET_CHECKBOX}
              checked={includeBudget}
              onCheckedChange={setIncludeBudget}
            />
            <FieldLabel htmlFor={BUDGET_CHECKBOX}>Include budget ends</FieldLabel>
          </div>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {mobile ? panelView : paretoView}
        {mobile ? paretoView : panelView}
      </div>
    </section>
  );
}
