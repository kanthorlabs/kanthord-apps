import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { RevealPanel } from "@/components/reveal";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { badgeVariantOf } from "@/lib/node-state";
import { relativeAge } from "@/lib/relative-age";

import type { JobView, QueueGroup } from "../use-scheduler-board";

interface NextSectionProps {
  readonly queue: readonly QueueGroup[];
  readonly showProjects: boolean;
  readonly now: number;
}

function JobItem({ view, now }: { readonly view: JobView; readonly now: number }) {
  return (
    <Item variant="outline" role="listitem">
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full flex-wrap">
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="tabular-nums text-muted-foreground">{view.position}</span>
            <Link to={view.href} className="break-words underline underline-offset-4">
              {view.nodeName}
            </Link>
          </span>
          {view.state !== null && <Badge variant={badgeVariantOf(view.state)}>{view.state}</Badge>}
          {view.claim !== null && <Badge variant="secondary">{view.claim} claim</Badge>}
          {view.noTaker && <Badge variant="destructive">No taker</Badge>}
        </ItemTitle>
        <ItemDescription>
          priority {view.job.priority} · queued {relativeAge(view.queuedAt, now)}
        </ItemDescription>
        <ItemDescription className="break-all">job {view.job.job_id}</ItemDescription>
      </ItemContent>
    </Item>
  );
}

function QueueGroupItems({
  group,
  showProjects,
  now,
}: {
  readonly group: QueueGroup;
  readonly showProjects: boolean;
  readonly now: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="flex flex-col gap-2">
      {showProjects && <h4 className="text-sm font-medium">{group.project.name}</h4>}
      <ItemGroup
        aria-label={showProjects ? `Queue of ${group.project.name}` : "Queue"}
        className="gap-2"
      >
        {group.first.map((view) => (
          <JobItem key={view.job.job_id} view={view} now={now} />
        ))}
      </ItemGroup>
      {group.more.length > 0 && (
        <>
          <RevealPanel>
            <ItemGroup
              aria-label={
                showProjects ? `More of the queue of ${group.project.name}` : "More of the queue"
              }
              className="gap-2"
            >
              {group.more.map((view) => (
                <JobItem key={view.job.job_id} view={view} now={now} />
              ))}
            </ItemGroup>
          </RevealPanel>
          <CollapsibleTrigger
            render={<Button variant="outline" size="sm" className="self-start" />}
          >
            <ChevronDownIcon aria-hidden="true" data-icon="inline-start" />
            {open
              ? "Show fewer jobs"
              : `${group.more.length} more ${group.more.length === 1 ? "job" : "jobs"}`}
          </CollapsibleTrigger>
        </>
      )}
    </Collapsible>
  );
}

export function NextSection({ queue, showProjects, now }: NextSectionProps) {
  return (
    <section aria-labelledby="scheduler-next" className="flex flex-col gap-3">
      <h3 id="scheduler-next" className="text-base font-semibold">
        Next
      </h3>
      <p className="text-sm text-muted-foreground">
        Highest priority first, then the oldest job. A worker claims the first job that its worker
        admits. The order predicts no claimant.
      </p>
      {queue.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No job waits.</EmptyTitle>
            <EmptyDescription>
              A Pending, Blocked or Paused node holds no job. <Link to="/">Overview</Link> lists the
              nodes that wait for you.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        queue.map((group) => (
          <QueueGroupItems
            key={group.project.id}
            group={group}
            showProjects={showProjects}
            now={now}
          />
        ))
      )}
    </section>
  );
}
