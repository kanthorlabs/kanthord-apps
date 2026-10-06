import { PencilIcon } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { utcDateTime } from "@/lib/format";
import { useCrumbLabel } from "@/components/crumb-labels";
import { BindingsPanel } from "./components/bindings-panel";
import { MissionPanel } from "./components/mission-panel";
import { useProjectDetail } from "./use-project-detail";
import { useProjectTab, type ProjectTab } from "./use-project-tab";

export function ProjectScreen() {
  const { projectId = "" } = useParams<{ projectId: string }>();
  const { data: project, error, loading, reload } = useProjectDetail(projectId);
  const { tab, selectTab } = useProjectTab();
  useCrumbLabel(`/projects/${encodeURIComponent(projectId)}`, project?.name);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error !== null || project === null) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm text-destructive">{error?.message}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={reload}>
            Retry
          </Button>
          <Button nativeButton={false} render={<Link to="/projects" />} variant="ghost" size="sm">
            Back to projects
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-3">
      <section aria-label="Project" className="flex flex-col gap-1 border-b pb-3">
        <div className="flex flex-col items-start gap-2 md:flex-row md:justify-between">
          <h2 className="min-w-0 text-lg font-semibold break-words">{project.name}</h2>
          <Button
            nativeButton={false}
            render={<Link to={`/projects/${encodeURIComponent(project.id)}/edit`} />}
            variant="outline"
            size="sm"
          >
            <PencilIcon aria-hidden="true" data-icon="inline-start" />
            Edit
          </Button>
        </div>
        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <div className="flex min-w-0 gap-1">
            <dt>Identity</dt>
            <dd className="min-w-0 font-mono break-all text-foreground">{project.id}</dd>
          </div>
          <div className="flex gap-1">
            <dt>Created</dt>
            <dd className="text-foreground">{utcDateTime(project.createdAt)}</dd>
          </div>
          <div className="flex min-w-0 gap-1">
            <dt>Workspace Directory</dt>
            <dd className="min-w-0 font-mono break-all text-foreground">
              {project.workspaceDirectory}
            </dd>
          </div>
        </dl>
      </section>
      <Tabs
        value={tab}
        onValueChange={(value) => selectTab(value as ProjectTab)}
        className="flex flex-1 flex-col gap-3"
      >
        <TabsList>
          <TabsTrigger value="mission">Mission</TabsTrigger>
          <TabsTrigger value="bindings">Bindings</TabsTrigger>
        </TabsList>
        <TabsContent value="mission" className="flex flex-1 flex-col">
          <MissionPanel projectId={project.id} projectName={project.name} />
        </TabsContent>
        <TabsContent value="bindings">
          <BindingsPanel projectId={project.id} onWritten={reload} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
