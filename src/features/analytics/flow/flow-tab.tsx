import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

import { ReadState } from "./read-state";
import type { FlowReadView } from "./use-flow";

interface FlowTabProps {
  readonly view: FlowReadView;
}

function FlowSkeleton() {
  return (
    <div role="status" aria-label="Loading the flow" className="flex flex-col gap-2">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

function NoExecutions() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>No executions claimed in this range.</EmptyTitle>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center">
        <Button nativeButton={false} variant="outline" size="sm" render={<Link to="/scheduler" />}>
          Scheduler
        </Button>
        <Button nativeButton={false} variant="outline" size="sm" render={<Link to="/workers" />}>
          Workers
        </Button>
      </EmptyContent>
    </Empty>
  );
}

export function FlowTab({ view }: FlowTabProps) {
  return (
    <ReadState view={view} skeleton={<FlowSkeleton />}>
      {view.empty ? <NoExecutions /> : null}
    </ReadState>
  );
}
