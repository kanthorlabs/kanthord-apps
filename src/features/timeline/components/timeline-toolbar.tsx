import { Link } from "react-router-dom";

import { DisabledAction } from "@/components/disabled-action";
import { Button } from "@/components/ui/button";
import { nodePath } from "@/lib/node-path";
import type { TimeRange, TimeWindow } from "@/lib/trace-query";

import { FilterSelect } from "../../traces/list/components/filter-select";
import { RangeFilter } from "../../traces/list/components/range-filter";
import type { TimelineScopeView } from "../use-timeline";

interface TimelineToolbarProps {
  readonly scope: TimelineScopeView;
  readonly range: TimeRange;
  readonly window: TimeWindow | null;
  readonly onRange: (range: string | null) => void;
  readonly onProject: (projectId: string | null) => void;
}

function NodeScope({ scope }: { readonly scope: Extract<TimelineScopeView, { kind: "node" }> }) {
  const { projectId, nodeId, nodeName } = scope;
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {projectId === null ? (
        <span className="min-w-0 font-medium break-words">{nodeName}</span>
      ) : (
        <Link
          className="min-w-0 font-medium break-words underline-offset-4 hover:underline"
          to={nodePath(projectId, nodeId)}
        >
          {nodeName}
        </Link>
      )}
      {projectId === null ? (
        <DisabledAction
          label="Show project"
          reason="The project is known once the node has history."
        />
      ) : (
        <Button
          nativeButton={false}
          render={<Link to={`/timeline?project_id=${encodeURIComponent(projectId)}`} />}
          variant="outline"
          size="sm"
        >
          Show project
        </Button>
      )}
    </div>
  );
}

export function TimelineToolbar({
  scope,
  range,
  window,
  onRange,
  onProject,
}: TimelineToolbarProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
      {scope.kind === "node" ? (
        <NodeScope scope={scope} />
      ) : (
        <div className="w-full md:w-56">
          <FilterSelect
            label="Project"
            allLabel={null}
            options={scope.projects.map((project) => ({ value: project.id, label: project.name }))}
            value={scope.projectId}
            onChange={onProject}
          />
        </div>
      )}
      <div className="w-full md:w-44">
        <RangeFilter value={range} window={window} onChange={onRange} />
      </div>
    </div>
  );
}
