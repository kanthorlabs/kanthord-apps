import { Link } from "react-router-dom";

import { ProjectFilter } from "@/components/project-filter";
import { RefreshStatus } from "@/components/refresh-status";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

import { AttentionSection } from "./components/attention-section";
import { ProgressSection } from "./components/progress-section";
import { StatusLine } from "./components/status-line";
import { SystemHealthAlert } from "./components/system-health-alert";
import { useOverview } from "./use-overview";

function SectionSkeletons() {
  return (
    <div className="flex flex-col gap-6">
      {["Status", "Needs you", "Mission progress"].map((section) => (
        <Skeleton key={section} className="h-24 w-full" />
      ))}
    </div>
  );
}

interface OverviewScreenProps {
  readonly onResume?: () => void;
}

export function OverviewScreen({ onResume }: OverviewScreenProps) {
  const overview = useOverview();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
        <h2 className="text-lg font-semibold">Overview</h2>
        {onResume !== undefined && (
          <Button variant="link" size="sm" className="self-start" onClick={onResume}>
            Resume onboarding
          </Button>
        )}
        {overview.status === "ready" && (
          <>
            <div className="w-full md:w-64">
              <ProjectFilter
                projects={overview.projects}
                value={overview.projectId}
                onChange={overview.selectProject}
              />
            </div>
            <div className="md:ml-auto">
              <RefreshStatus
                updatedAt={overview.updatedAt}
                now={overview.now}
                onRefresh={overview.refresh}
              />
            </div>
          </>
        )}
      </div>

      {overview.status === "loading" && <SectionSkeletons />}

      {overview.status === "empty" && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No projects</EmptyTitle>
            <EmptyDescription>This instance holds no project.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button nativeButton={false} render={<Link to="/projects/new" />} size="lg">
              New project
            </Button>
          </EmptyContent>
        </Empty>
      )}

      {overview.status === "error" && overview.error !== null && (
        <Alert variant="destructive">
          <AlertTitle>The overview could not be read.</AlertTitle>
          <AlertDescription>{overview.error.message}</AlertDescription>
          <div className="mt-2 flex md:justify-end">
            <Button variant="outline" size="sm" onClick={overview.refresh}>
              Retry
            </Button>
          </div>
        </Alert>
      )}

      {overview.status === "ready" && (
        <>
          <SystemHealthAlert components={overview.unavailable} failure={overview.livenessFailure} />
          <StatusLine
            running={overview.running}
            waiting={overview.waiting}
            schedulerPath={overview.schedulerPath}
            cooling={overview.cooling}
            showProject={overview.showProjects}
          />
          <AttentionSection
            summary={overview.summary}
            groups={overview.groups}
            faults={overview.faults}
            allClear={overview.allClear}
            details={overview.details}
            showProject={overview.showProjects}
            now={overview.now}
            reload={overview.refresh}
            retryDetail={overview.retryDetail}
            setDialogOpen={overview.setDialogOpen}
            focus={overview.focus}
          />
          <ProgressSection progress={overview.progress} />
        </>
      )}
    </div>
  );
}
