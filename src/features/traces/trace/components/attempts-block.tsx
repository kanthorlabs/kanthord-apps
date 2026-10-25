import { Link } from "react-router-dom";

import { DataList } from "@/components/data-list";
import { DataListItem } from "@/components/data-list-item";
import { TouchTarget } from "@/components/touch-target";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import type { NodeAttempt, NodeExecution, NodeTraces } from "../use-node-traces";

function ExecutionRow({ execution }: { readonly execution: NodeExecution }) {
  return (
    <DataListItem
      title={`${execution.kindLabel} ${execution.stateLabel}`}
      status={
        <>
          {execution.isRepeat && <Badge variant="destructive">Repeat</Badge>}
          {execution.current && <Badge variant="secondary">This trace</Badge>}
          {execution.promptChanged && <Badge variant="outline">Prompt changed</Badge>}
        </>
      }
      description={execution.causeText ?? undefined}
      fields={[{ label: "Duration", value: execution.durationLabel }]}
      notice={execution.advice === null ? undefined : <p className="text-sm">{execution.advice}</p>}
      actions={
        <TouchTarget>
          <Button
            nativeButton={false}
            render={<Link to={execution.path} />}
            variant="outline"
            size="sm"
            aria-label={`Open trace ${execution.traceId}`}
          >
            Open trace
          </Button>
        </TouchTarget>
      }
    />
  );
}

function AttemptSection({ group }: { readonly group: NodeAttempt }) {
  const title =
    group.nodeRevision === null
      ? `Attempt ${group.attempt}`
      : `Attempt ${group.attempt} (v${group.nodeRevision})`;
  return (
    <section aria-label={title} className="flex min-w-0 flex-col gap-2">
      <h4 className="text-sm font-medium">{title}</h4>
      {group.planChanged && (
        <p className="text-sm text-muted-foreground">Plan changed in (v{group.nodeRevision})</p>
      )}
      <DataList
        label={`Executions of attempt ${group.attempt}`}
        items={group.executions}
        getKey={(execution) => execution.traceId}
        renderItem={(execution) => <ExecutionRow execution={execution} />}
        status="ready"
        error={null}
        pending={false}
        emptyText="No executions recorded."
      />
    </section>
  );
}

function Body({ node }: { readonly node: NodeTraces }) {
  if (node.loading)
    return <Skeleton role="status" aria-label="Loading attempts" className="h-24 w-full" />;
  return (
    <>
      {node.error !== null && (
        <Alert variant="destructive" className="flex flex-wrap items-center gap-2">
          <AlertDescription>{node.error.message}</AlertDescription>
          <TouchTarget>
            <Button variant="outline" size="sm" onClick={node.retry}>
              Retry
            </Button>
          </TouchTarget>
        </Alert>
      )}
      {node.groups.length === 0 && node.error === null && (
        <p className="text-muted-foreground">This node has no recorded attempts.</p>
      )}
      {node.repeatedExecutions > 0 && (
        <p className="text-sm">
          Repeated executions: {node.repeatedExecutions}. Attempts with a repeat:{" "}
          {node.repeatedAttempts}.
        </p>
      )}
      {node.groups.map((group) => (
        <AttemptSection key={group.attempt} group={group} />
      ))}
    </>
  );
}

interface AttemptsBlockProps {
  readonly node: NodeTraces;
}

export function AttemptsBlock({ node }: AttemptsBlockProps) {
  return (
    <section aria-label="Attempts of this node" className="flex min-w-0 flex-col gap-3">
      <h3 className="text-base font-semibold">Attempts of this node</h3>
      <Body node={node} />
    </section>
  );
}
