import { Link } from "react-router-dom";

import { DisabledAction } from "@/components/disabled-action";
import { Button } from "@/components/ui/button";
import { nodePath } from "@/lib/node-path";
import { TIME_RANGE_LABELS, type TimeRange } from "@/lib/trace-query";

import { FilterSelect, type FilterOption } from "../../traces/list/components/filter-select";
import type { TimelineScopeView } from "../use-timeline";

const RANGE_OPTIONS: readonly FilterOption[] = Object.entries(TIME_RANGE_LABELS).map(
  ([value, label]) => ({ value, label }),
);

interface TimelineToolbarProps {
  readonly scope: TimelineScopeView;
  readonly range: TimeRange;
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

export function TimelineToolbar({ scope, range, onRange, onProject }: TimelineToolbarProps) {
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
        <FilterSelect
          label="Time range"
          allLabel={null}
          options={RANGE_OPTIONS}
          value={range}
          onChange={onRange}
        />
      </div>
    </div>
  );
}
