import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ItemGroup } from "@/components/ui/item";

import type { FailedView } from "../use-scheduler-board";
import { ExecutionItem } from "./execution-item";

interface FailedSectionProps {
  readonly failed: readonly FailedView[];
  readonly now: number;
}

export function FailedSection({ failed, now }: FailedSectionProps) {
  return (
    <section aria-labelledby="scheduler-failed" className="flex flex-col gap-3">
      <h3 id="scheduler-failed" className="text-base font-semibold">
        Failed
      </h3>
      <p className="text-sm text-muted-foreground">
        Executions that ended with a stop or were lost, newest first. The list reads the latest 100
        executions of each project. History holds every ended execution.
      </p>
      {failed.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No execution failed.</EmptyTitle>
            <EmptyDescription>History holds every ended execution.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ItemGroup aria-label="Failed executions" className="gap-2">
          {failed.map((view) => (
            <ExecutionItem
              key={view.execution.execution_id}
              execution={view.execution}
              nodeName={view.nodeName}
              href={view.href}
              projectName={view.projectName}
              kind={null}
              now={now}
            />
          ))}
        </ItemGroup>
      )}
    </section>
  );
}
