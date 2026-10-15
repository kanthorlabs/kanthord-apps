import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ItemGroup } from "@/components/ui/item";

import type { RunningView } from "../use-scheduler-board";
import { ExecutionItem } from "./execution-item";

interface NowSectionProps {
  readonly running: readonly RunningView[];
  readonly now: number;
}

export function NowSection({ running, now }: NowSectionProps) {
  return (
    <section aria-labelledby="scheduler-now" className="flex flex-col gap-3">
      <h3 id="scheduler-now" className="text-base font-semibold">
        Now
      </h3>
      {running.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No execution runs now.</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <ItemGroup aria-label="Running executions" className="gap-2">
          {running.map((view) => (
            <ExecutionItem
              key={view.execution.execution_id}
              execution={view.execution}
              nodeName={view.nodeName}
              href={view.href}
              projectName={view.projectName}
              kind={view.kind}
              now={now}
            />
          ))}
        </ItemGroup>
      )}
    </section>
  );
}
