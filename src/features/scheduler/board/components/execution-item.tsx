import { Link } from "react-router-dom";

import type { ClaimState, SchedulerExecutionRecord } from "@/api/types";
import { RecordName } from "@/components/record-name";
import { Badge } from "@/components/ui/badge";
import { Item, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
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
        <ItemDescription className="line-clamp-none">
          binding <RecordName>{bindingNameOf(execution.claimant)}</RecordName> · instance{" "}
          {execution.claimant.name === undefined ? (
            <span className="break-all">{execution.claimant.runtime_identity}</span>
          ) : (
            <RecordName>{execution.claimant.name}</RecordName>
          )}{" "}
          · attempt {execution.attempt} · pinned revision {execution.pinned_revision}
        </ItemDescription>
        <ItemDescription className="break-all">execution {execution.execution_id}</ItemDescription>
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
    </Item>
  );
}
