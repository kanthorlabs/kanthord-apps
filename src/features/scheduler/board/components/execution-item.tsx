import { ChevronDownIcon } from "lucide-react";
import { Link } from "react-router-dom";

import type { ClaimState, SchedulerExecutionRecord } from "@/api/types";
import { RecordName } from "@/components/record-name";
import { RevealPanel } from "@/components/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { bindingNameOf } from "@/lib/execution-claimant";
import { endTimeOf, stopLabel } from "@/lib/execution-stop";
import { durationText, utcDateTime } from "@/lib/format";
import { relativeAge } from "@/lib/relative-age";

import type { ClaimKind } from "../use-scheduler-board";

const ENDED_BADGES: Partial<
  Record<ClaimState, { readonly label: string; readonly variant: "destructive" | "outline" }>
> = {
  lost: { label: "Lost", variant: "destructive" },
  finished: { label: "Finished", variant: "outline" },
};

interface ExecutionItemProps {
  readonly execution: SchedulerExecutionRecord;
  readonly nodeName: string;
  readonly href: string;
  readonly projectName: string | null;
  readonly kind: ClaimKind | null;
  readonly now: number;
}

export function ExecutionItem({
  execution,
  nodeName,
  href,
  projectName,
  kind,
  now,
}: ExecutionItemProps) {
  const ended = ENDED_BADGES[execution.claim_state];
  const endedAt = endTimeOf(execution);
  return (
    <Collapsible role="listitem" className="flex flex-col">
      <Item variant="outline">
        <ItemContent className="min-w-0">
          <ItemTitle className="w-full flex-wrap">
            <span className="flex min-w-0 items-baseline gap-1">
              <Link to={href} className="break-words underline underline-offset-4">
                {nodeName}
              </Link>
              <span className="text-muted-foreground tabular-nums">
                (v{execution.pinned_revision})
              </span>
            </span>
            {kind !== null && <Badge variant="secondary">{kind}</Badge>}
            {ended !== undefined && <Badge variant={ended.variant}>{ended.label}</Badge>}
            {execution.stop !== null && (
              <Badge variant="outline">{stopLabel(execution.stop)}</Badge>
            )}
          </ItemTitle>
          {projectName !== null && (
            <ItemDescription>
              project <RecordName>{projectName}</RecordName>
            </ItemDescription>
          )}
          {execution.stop?.detail !== undefined && (
            <ItemDescription className="line-clamp-none break-words">
              Cause: {execution.stop.detail}
            </ItemDescription>
          )}
          {endedAt === null ? (
            <ItemDescription>
              <span>Started {relativeAge(execution.created_at, now)}</span> ·{" "}
              <span>Deadline {utcDateTime(execution.expired_at)}</span>
            </ItemDescription>
          ) : (
            <ItemDescription>
              <span>Ended {relativeAge(endedAt, now)}</span> ·{" "}
              <span>duration {durationText(endedAt - execution.created_at)}</span>
            </ItemDescription>
          )}
          {execution.claim_state === "lost" && (
            <ItemDescription>Expiry is not proof that the runtime stopped.</ItemDescription>
          )}
        </ItemContent>
        <ItemActions className="basis-full md:basis-auto md:justify-end">
          <CollapsibleTrigger
            render={<Button variant="ghost" size="sm" />}
            aria-label={`Details of the execution of ${nodeName}`}
          >
            <ChevronDownIcon aria-hidden="true" data-icon="inline-start" />
            Details
          </CollapsibleTrigger>
        </ItemActions>
      </Item>
      <RevealPanel>
        <div className="flex flex-col gap-1 px-4 pt-2 pb-1 text-sm text-muted-foreground">
          <p className="break-words">
            binding <RecordName>{bindingNameOf(execution.claimant)}</RecordName> · registration{" "}
            {execution.claimant.name === undefined ? (
              <span className="break-all">{execution.claimant.runtime_identity}</span>
            ) : (
              <RecordName>{execution.claimant.name}</RecordName>
            )}{" "}
            · attempt {execution.attempt}
          </p>
          <p className="break-all">execution {execution.execution_id}</p>
        </div>
      </RevealPanel>
    </Collapsible>
  );
}
