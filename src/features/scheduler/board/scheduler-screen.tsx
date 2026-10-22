import { ProjectFilter } from "@/components/project-filter";
import { RefreshStatus } from "@/components/refresh-status";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { DoneSection } from "./components/done-section";
import { FailedSection } from "./components/failed-section";
import { NextSection } from "./components/next-section";
import { NowSection } from "./components/now-section";
import { PausedProjectAlert } from "./components/paused-project-alert";
import { useSchedulerBoard } from "./use-scheduler-board";
import { useSchedulerView, type SchedulerView } from "./use-scheduler-view";

function SectionSkeletons() {
  return (
    <div className="flex flex-col gap-6">
      {["Now", "Next", "Done"].map((section) => (
        <Skeleton key={section} className="h-24 w-full" />
      ))}
    </div>
  );
}

export function SchedulerScreen() {
  const board = useSchedulerBoard();
  const { view, selectView } = useSchedulerView();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
        <h2 className="text-lg font-semibold">Scheduler</h2>
        {board.status === "ready" && (
          <>
            <div className="w-full md:w-64">
              <ProjectFilter
                projects={board.projects}
                value={board.projectId}
                onChange={board.selectProject}
              />
            </div>
            <div className="md:ml-auto">
              <RefreshStatus
                updatedAt={board.updatedAt}
                now={board.now}
                onRefresh={board.refresh}
              />
            </div>
          </>
        )}
      </div>

      {board.status === "loading" && <SectionSkeletons />}

      {board.status === "error" && board.error !== null && (
        <Alert variant="destructive">
          <AlertTitle>The scheduler could not be read.</AlertTitle>
          <AlertDescription>{board.error.message}</AlertDescription>
          <div className="mt-2 flex md:justify-end">
            <Button variant="outline" size="sm" onClick={board.refresh}>
              Retry
            </Button>
          </div>
        </Alert>
      )}

      {board.status === "ready" && (
        <>
          {(board.error !== null || board.catalogError !== null) && (
            <Alert variant="destructive">
              <AlertTitle>The scheduler could not be refreshed.</AlertTitle>
              <AlertDescription>
                {board.error !== null &&
                  `${board.error.message} The lists show the last data that was read. `}
                {board.catalogError !== null &&
                  "The worker catalog could not be read. No taker is not checked."}
              </AlertDescription>
              <div className="mt-2 flex md:justify-end">
                <Button variant="outline" size="sm" onClick={board.refresh}>
                  Retry
                </Button>
              </div>
            </Alert>
          )}
          {board.pausedProjects.map((project) => (
            <PausedProjectAlert key={project.id} project={project} onResumed={board.refresh} />
          ))}
          <Tabs
            value={view}
            onValueChange={(value) => selectView(value as SchedulerView)}
            className="flex flex-col gap-4"
          >
            <TabsList className="w-full md:w-fit">
              <TabsTrigger value="live">Live</TabsTrigger>
              <TabsTrigger value="failed">
                Failed
                {board.failed.length > 0 && (
                  <Badge variant="destructive">{board.failed.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            <TabsContent value="live" className="flex flex-col gap-6">
              <NowSection running={board.running} now={board.now} />
              <NextSection queue={board.queue} showProjects={board.showProjects} now={board.now} />
            </TabsContent>
            <TabsContent value="failed">
              <FailedSection failed={board.failed} now={board.now} />
            </TabsContent>
            <TabsContent value="history">
              <DoneSection
                done={board.done}
                showProjects={board.showProjects}
                signal={board.refreshSignal}
                now={board.now}
              />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
