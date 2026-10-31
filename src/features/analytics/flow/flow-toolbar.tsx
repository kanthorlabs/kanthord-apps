import { TriangleAlertIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { ProjectFilter } from "@/components/project-filter";
import { RefreshStatus } from "@/components/refresh-status";
import { TouchTarget } from "@/components/touch-target";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FLOW_RANGES } from "@/lib/flow-query";

import { FilterSelect } from "../../traces/list/components/filter-select";
import type { FlowView } from "./use-flow";

interface FlowToolbarProps {
  readonly flow: FlowView;
  readonly onRefresh: () => void;
}

export function FlowToolbar({ flow, onRefresh }: FlowToolbarProps) {
  const { filters, dataBadge } = flow;
  return (
    <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
      <div className="w-full md:w-56">
        <ProjectFilter
          projects={flow.projects}
          value={filters.projectId}
          onChange={flow.selectProject}
        />
      </div>
      <div className="w-full md:w-44">
        <FilterSelect
          label="Worker"
          allLabel="All workers"
          options={flow.workerOptions}
          value={filters.workerName}
          onChange={flow.selectWorker}
        />
      </div>
      <ToggleGroup
        aria-label="Range"
        variant="outline"
        value={[filters.range]}
        onValueChange={(next) => {
          const [range] = next;
          if (range !== undefined) flow.selectRange(range);
        }}
      >
        {FLOW_RANGES.map((range) => (
          <TouchTarget key={range}>
            <ToggleGroupItem value={range}>{range}</ToggleGroupItem>
          </TouchTarget>
        ))}
      </ToggleGroup>
      <div className="flex flex-wrap items-center gap-2 md:ml-auto">
        {dataBadge !== null && (
          <Badge variant="outline" render={<Link to={dataBadge.href} />}>
            {dataBadge.active && (
              <>
                <TriangleAlertIcon aria-hidden="true" className="text-flow-warn-glyph" />
                <span className="sr-only">Warning</span>{" "}
              </>
            )}
            {dataBadge.text}
          </Badge>
        )}
        <RefreshStatus updatedAt={flow.updatedAt} now={flow.now} onRefresh={onRefresh} />
        <TouchTarget>
          <Toggle variant="outline" size="sm" pressed={flow.held} onPressedChange={flow.setHeld}>
            Pause auto-refresh
          </Toggle>
        </TouchTarget>
        {flow.notRefreshedSince !== null && (
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            Not refreshed since {flow.notRefreshedSince} ·{" "}
            <Button variant="outline" size="sm" onClick={flow.refresh}>
              Retry
            </Button>
          </p>
        )}
      </div>
    </div>
  );
}
