import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

import { FlowSection } from "./flow-section";
import { ReadState } from "./read-state";
import type { FlowReadView, FlowView } from "./use-flow";

interface FlowTabProps {
  readonly view: FlowReadView & Pick<FlowView, "filters">;
}

const FLOW_COLUMNS = [0, 1, 2, 3, 4, 5] as const;

function FlowSkeleton() {
  return (
    <div role="status" aria-label="Loading the flow">
      <ul className="grid grid-cols-2 gap-2 md:grid-cols-6">
        {FLOW_COLUMNS.map((column) => (
          <li key={column}>
            <Skeleton className="h-40 w-full" />
          </li>
        ))}
      </ul>
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
      {view.read !== null && !view.empty && <FlowSection read={view.read} filters={view.filters} />}
      {view.empty ? <NoExecutions /> : null}
    </ReadState>
  );
}
