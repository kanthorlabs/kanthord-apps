import { PlusIcon } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import type { Project } from "@/api/types";
import { DataList } from "@/components/data-list";
import { DataListItem } from "@/components/data-list-item";
import { ProjectPauseButton } from "@/components/project-pause-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { utcDateTime } from "@/lib/format";
import { useProjectList } from "./use-project-list";
import { progressTextOf, type ProjectState, useProjectStates } from "./use-project-states";

interface ProjectItemProps {
  readonly project: Project;
  readonly state: ProjectState;
  readonly onChanged: () => void;
}

function ProjectItem({ project, state, onChanged }: ProjectItemProps) {
  const navigate = useNavigate();

  return (
    <DataListItem
      title={project.name}
      status={
        <>
          {project.paused_at !== null && <Badge variant="secondary">Paused</Badge>}
          {state.status === "ready" && state.held > 0 && (
            <Badge variant="destructive">Blocked or paused · {state.held}</Badge>
          )}
          {state.status === "ready" && state.running > 0 && (
            <Badge>Running · {state.running}</Badge>
          )}
        </>
      }
      select={{
        label: `Open ${project.name}`,
        disabled: false,
        onSelect: () => navigate(`/projects/${encodeURIComponent(project.id)}`),
      }}
      fields={[
        { label: "Progress", value: progressTextOf(state) },
        { label: "Created", value: utcDateTime(project.created_at) },
      ]}
      actions={<ProjectPauseButton project={project} onChanged={onChanged} />}
    />
  );
}

export function ProjectsScreen() {
  const pages = useProjectList();
  const stateOf = useProjectStates(pages.items);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button nativeButton={false} render={<Link to="/projects/new" />} size="lg">
          <PlusIcon aria-hidden="true" data-icon="inline-start" />
          New project
        </Button>
      </div>
      <DataList
        label="Projects"
        items={pages.items}
        getKey={(project) => project.id}
        renderItem={(project) => (
          <ProjectItem project={project} state={stateOf(project.id)} onChanged={pages.reload} />
        )}
        status={pages.status}
        error={pages.error?.message ?? null}
        pending={pages.pending}
        onRetry={pages.retry}
        emptyText="No projects. Create the first project with New project."
        pager={{
          hasPrevious: pages.hasPrevious,
          hasNext: pages.hasNext,
          position: pages.position,
          onPrevious: pages.previous,
          onNext: pages.next,
        }}
      />
    </div>
  );
}
