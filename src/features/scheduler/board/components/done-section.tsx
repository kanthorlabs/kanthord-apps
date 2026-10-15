import { DataList } from "@/components/data-list";

import { useDoneGroup } from "../use-done-group";
import type { DoneSource, RefreshSignal } from "../use-scheduler-board";
import { ExecutionItem } from "./execution-item";

interface DoneSectionProps {
  readonly done: readonly DoneSource[];
  readonly showProjects: boolean;
  readonly signal: RefreshSignal;
  readonly now: number;
}

interface DoneGroupProps {
  readonly source: DoneSource;
  readonly showProject: boolean;
  readonly signal: RefreshSignal;
  readonly now: number;
}

function DoneGroup({ source, showProject, signal, now }: DoneGroupProps) {
  const { project } = source;
  const { pages, views } = useDoneGroup(source, showProject, signal);
  return (
    <div className="flex flex-col gap-2">
      {showProject && <h4 className="text-sm font-medium">{project.name}</h4>}
      <DataList
        label={showProject ? `Done executions of ${project.name}` : "Done executions"}
        items={views}
        getKey={(view) => view.execution.execution_id}
        renderItem={(view) => (
          <ExecutionItem
            execution={view.execution}
            nodeName={view.nodeName}
            href={view.href}
            projectName={view.projectName}
            kind={null}
            now={now}
          />
        )}
        status={pages.status}
        error={pages.error?.message ?? null}
        pending={pages.pending}
        onRetry={pages.retry}
        emptyText="No execution ended yet."
        pager={{
          hasPrevious: pages.hasPrevious,
          hasNext: pages.hasNext,
          position: pages.position,
          onPrevious: pages.previous,
          onNext: pages.next,
        }}
      />
    </div>
  );
}

export function DoneSection({ done, showProjects, signal, now }: DoneSectionProps) {
  return (
    <section aria-labelledby="scheduler-done" className="flex flex-col gap-3">
      <h3 id="scheduler-done" className="text-base font-semibold">
        Done
      </h3>
      {done.map((source) => (
        <DoneGroup
          key={source.project.id}
          source={source}
          showProject={showProjects}
          signal={signal}
          now={now}
        />
      ))}
    </section>
  );
}
