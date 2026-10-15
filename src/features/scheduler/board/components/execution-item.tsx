import { Link } from "react-router-dom";

import type { ClaimState, SchedulerExecutionRecord } from "@/api/types";
import { RecordName } from "@/components/record-name";
import { Badge } from "@/components/ui/badge";
import { Item, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { bindingNameOf, instanceNameOf } from "@/lib/execution-claimant";
import { stopLabel } from "@/lib/execution-stop";
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
  return (
    <Item variant="outline" role="listitem">
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full flex-wrap">
          <Link to={href} className="break-words underline underline-offset-4">
            {nodeName}
          </Link>
          {kind !== null && <Badge variant="secondary">{kind}</Badge>}
          {ended !== undefined && <Badge variant={ended.variant}>{ended.label}</Badge>}
          {execution.stop !== null && <Badge variant="outline">{stopLabel(execution.stop)}</Badge>}
        </ItemTitle>
        {projectName !== null && (
          <ItemDescription>
            project <RecordName>{projectName}</RecordName>
          </ItemDescription>
        )}
        <ItemDescription>
          binding <RecordName>{bindingNameOf(execution.claimant)}</RecordName> · instance{" "}
          <RecordName>{instanceNameOf(execution.claimant)}</RecordName> · attempt{" "}
          {execution.attempt} · pinned revision {execution.pinned_revision}
        </ItemDescription>
        <ItemDescription className="break-all">execution {execution.execution_id}</ItemDescription>
        {execution.ended_at === null ? (
          <ItemDescription>
            <span>Started {relativeAge(execution.created_at, now)}</span> ·{" "}
            <span>Deadline {utcDateTime(execution.expired_at)}</span>
          </ItemDescription>
        ) : (
          <ItemDescription>
            <span>Ended {relativeAge(execution.ended_at, now)}</span> ·{" "}
            <span>duration {durationText(execution.ended_at - execution.created_at)}</span>
          </ItemDescription>
        )}
        {execution.claim_state === "lost" && (
          <ItemDescription>Expiry is not proof that the runtime stopped.</ItemDescription>
        )}
      </ItemContent>
    </Item>
  );
}
