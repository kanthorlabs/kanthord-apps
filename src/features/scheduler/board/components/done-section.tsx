import { DataList } from "@/components/data-list";
import { nodePath } from "@/lib/node-path";

import { useDoneGroup } from "../use-done-group";
import type { DoneSource } from "../use-scheduler-board";
import { ExecutionItem } from "./execution-item";

interface DoneSectionProps {
  readonly done: readonly DoneSource[];
  readonly showProjects: boolean;
  readonly refreshedAt: number | null;
  readonly now: number;
}

interface DoneGroupProps {
  readonly source: DoneSource;
  readonly showProject: boolean;
  readonly refreshedAt: number | null;
  readonly now: number;
}

function DoneGroup({ source, showProject, refreshedAt, now }: DoneGroupProps) {
  const { project, nodeNames } = source;
  const { pages, executions } = useDoneGroup(project.id, refreshedAt);
  return (
    <div className="flex flex-col gap-2">
      {showProject && <h4 className="text-sm font-medium">{project.name}</h4>}
      <DataList
        label={showProject ? `Done executions of ${project.name}` : "Done executions"}
        items={executions}
        getKey={(execution) => execution.execution_id}
        renderItem={(execution) => (
          <ExecutionItem
            execution={execution}
            nodeName={nodeNames.get(execution.node_id) ?? execution.node_id}
            href={nodePath(project.id, execution.node_id)}
            projectName={showProject ? project.name : null}
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

export function DoneSection({ done, showProjects, refreshedAt, now }: DoneSectionProps) {
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
          refreshedAt={refreshedAt}
          now={now}
        />
      ))}
    </section>
  );
}
