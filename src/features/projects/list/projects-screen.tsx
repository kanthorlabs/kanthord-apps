import { PlusIcon } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import type { Project } from "@/api/types";
import { DataList } from "@/components/data-list";
import { DataListItem } from "@/components/data-list-item";
import { Button } from "@/components/ui/button";
import { utcDateTime } from "@/lib/format";
import { useProjectList } from "./use-project-list";

function ProjectItem({ project }: { project: Project }) {
  const navigate = useNavigate();

  return (
    <DataListItem
      title={project.name}
      select={{
        label: `Open ${project.name}`,
        disabled: false,
        onSelect: () => navigate(`/projects/${encodeURIComponent(project.id)}`),
      }}
      fields={[
        { label: "Identity", value: <span className="font-mono break-all">{project.id}</span> },
        { label: "Created", value: utcDateTime(project.createdAt) },
      ]}
    />
  );
}

export function ProjectsScreen() {
  const pages = useProjectList();

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
        renderItem={(project) => <ProjectItem project={project} />}
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
