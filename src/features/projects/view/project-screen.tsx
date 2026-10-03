import { PencilIcon } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { utcDateTime } from "@/lib/format";
import { useProjectDetail } from "./use-project-detail";

export function ProjectScreen() {
  const { projectId = "" } = useParams<{ projectId: string }>();
  const { data: project, error, loading, reload } = useProjectDetail(projectId);

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
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="min-w-0 text-lg font-semibold break-words">{project.name}</h2>
        <Button
          nativeButton={false}
          render={<Link to={`/projects/${encodeURIComponent(project.id)}/edit`} />}
          variant="outline"
          size="lg"
        >
          <PencilIcon aria-hidden="true" data-icon="inline-start" />
          Edit
        </Button>
      </div>
      <Card>
        <CardHeader>
          <h3 className="font-semibold leading-none">Project</h3>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-muted-foreground">Name</dt>
            <dd className="min-w-0 break-words">{project.name}</dd>
            <dt className="text-muted-foreground">Identity</dt>
            <dd className="min-w-0 font-mono break-all">{project.id}</dd>
            <dt className="text-muted-foreground">Binding set version</dt>
            <dd className="tabular-nums">{project.bindingSetVersion}</dd>
            <dt className="text-muted-foreground">Created</dt>
            <dd>{utcDateTime(project.createdAt)}</dd>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
