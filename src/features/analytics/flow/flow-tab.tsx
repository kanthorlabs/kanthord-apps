import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

import { DataFooter } from "./data-footer";
import { FlowSection } from "./flow-section";
import { OutOfBounds } from "./out-of-bounds";
import { ReadState } from "./read-state";
import { StopReasonSection, StopReasonSkeleton } from "./stop-reason-section";
import type { FlowReadView, FlowView } from "./use-flow";
import { WhySection, WhySkeleton } from "./why-section";

interface FlowTabProps {
  readonly view: FlowReadView & Pick<FlowView, "filters">;
}

const FLOW_COLUMNS = [0, 1, 2, 3, 4, 5] as const;
const DATA_HASH = "#flow-data";
const DATA_ID = "flow-data";

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

function TabSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <FlowSkeleton />
      <WhySkeleton />
      <StopReasonSkeleton />
    </div>
  );
}

export function FlowTab({ view }: FlowTabProps) {
  const { hash } = useLocation();
  const ready = view.read !== null;

  useEffect(() => {
    if (ready && hash === DATA_HASH) document.getElementById(DATA_ID)?.focus();
  }, [ready, hash]);

  return (
    <ReadState view={view} skeleton={<TabSkeleton />}>
      {view.read !== null && (
        <div className="flex flex-col gap-6">
          {!view.empty && <OutOfBounds read={view.read} filters={view.filters} />}
          {view.empty ? <NoExecutions /> : <FlowSection read={view.read} filters={view.filters} />}
          <WhySection read={view.read} filters={view.filters} />
          <StopReasonSection read={view.read} filters={view.filters} />
          <DataFooter read={view.read} filters={view.filters} />
        </div>
      )}
    </ReadState>
  );
}
