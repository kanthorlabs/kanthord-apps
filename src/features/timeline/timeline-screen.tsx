import { DataList } from "@/components/data-list";
import { Button } from "@/components/ui/button";

import { TimelineRow } from "./components/timeline-row";
import { TimelineToolbar } from "./components/timeline-toolbar";
import { useTimeline } from "./use-timeline";

export function TimelineScreen() {
  const timeline = useTimeline();
  const { list } = timeline;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Timeline</h2>
      <TimelineToolbar
        scope={timeline.scope}
        range={timeline.range}
        onRange={timeline.selectRange}
        onProject={timeline.selectProject}
      />
      <DataList
        label="Timeline"
        items={timeline.rows}
        getKey={(row) => row.key}
        renderItem={(row) => <TimelineRow row={row} nodeNameOf={timeline.nodeNameOf} />}
        status={list.status}
        error={list.error?.message ?? null}
        pending={list.pending}
        onRetry={list.retry}
        emptyText="No history in this range."
      />
      {list.status === "ready" && list.hasNext && (
        <Button variant="outline" size="lg" disabled={list.pending} onClick={list.loadMore}>
          Load more
        </Button>
      )}
    </div>
  );
}
