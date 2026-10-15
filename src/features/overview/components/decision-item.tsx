import { useState } from "react";
import { Link } from "react-router-dom";

import { NodeDiscardDialog } from "@/components/node-discard-dialog";
import { NodeUnblockDialog } from "@/components/node-unblock-dialog";
import { RecordName } from "@/components/record-name";
import { Reveal } from "@/components/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import type { AttentionDetail, BlockedItem } from "@/lib/attention";
import { closingEventText } from "@/lib/mission-labels";
import { nodePath } from "@/lib/node-path";
import { badgeVariantOf } from "@/lib/node-state";
import { relativeAge } from "@/lib/relative-age";

import { useDecisionActs } from "../use-decision-acts";
import { AssessmentPanel } from "./assessment-panel";

interface DecisionItemProps {
  readonly item: BlockedItem;
  readonly detail: AttentionDetail | null;
  readonly showProject: boolean;
  readonly now: number;
  readonly reload: () => void;
  readonly retryDetail: (nodeId: string) => void;
  readonly setDialogOpen: (nodeId: string, open: boolean) => void;
}

export function DecisionItem({
  item,
  detail,
  showProject,
  now,
  reload,
  retryDetail,
  setDialogOpen,
}: DecisionItemProps) {
  const { node } = item;
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const acts = useDecisionActs(item, detail, { reload, setDialogOpen });
  const blocked = detail?.kind === "blocked" ? detail : null;

  return (
    <Item variant="outline" size="sm" role="listitem">
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full">
          <Link to={nodePath(item.project.id, node.id)} className="break-words underline">
            {node.content.name}
          </Link>
        </ItemTitle>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={badgeVariantOf(node.state)}>{node.state}</Badge>
          <Badge variant="outline">{item.cause}</Badge>
        </div>
        <ItemDescription className="line-clamp-none">
          {showProject && (
            <>
              project <RecordName>{item.project.name}</RecordName> ·{" "}
            </>
          )}
          {node.attempt === 0 ? "no attempt" : `attempt ${node.attempt}`} ·{" "}
          {item.at === null ? "age unknown" : relativeAge(item.at, now)}
        </ItemDescription>
        <ItemDescription className="line-clamp-none">
          {node.blocked_context === undefined
            ? "The node is blocked."
            : closingEventText(node.blocked_context.outcome.closing_event)}
        </ItemDescription>
        {acts.waiting !== null && (
          <ItemDescription className="line-clamp-none">
            {acts.waiting}
            {blocked?.proposals.status === "failed" && (
              <>
                {" "}
                <Button variant="outline" size="sm" onClick={() => retryDetail(node.id)}>
                  Retry
                </Button>
              </>
            )}
          </ItemDescription>
        )}
        <div>
          <Button
            variant="outline"
            size="sm"
            aria-expanded={assessmentOpen}
            onClick={() => setAssessmentOpen((open) => !open)}
          >
            {assessmentOpen ? "Hide assessment" : "Show assessment"}
          </Button>
        </div>
        <Reveal open={assessmentOpen}>
          <AssessmentPanel item={item} detail={blocked} onRetry={() => retryDetail(node.id)} />
        </Reveal>
      </ItemContent>
      {acts.ready && (
        <ItemActions className="w-full flex-wrap justify-start md:w-auto md:justify-end">
          {acts.unblock.available && (
            <Button variant="outline" size="sm" onClick={acts.unblock.request}>
              Unblock
            </Button>
          )}
          {acts.discard.available && (
            <Button variant="destructive" size="sm" onClick={acts.discard.request}>
              Discard
            </Button>
          )}
        </ItemActions>
      )}
      <NodeUnblockDialog name={node.content.name} unblock={acts.unblock} />
      <NodeDiscardDialog name={node.content.name} discard={acts.discard} />
    </Item>
  );
}
