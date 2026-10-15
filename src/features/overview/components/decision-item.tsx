import { useState } from "react";
import { Link } from "react-router-dom";

import { NodeDiscardDialog } from "@/components/node-discard-dialog";
import { NodeUnblockDialog } from "@/components/node-unblock-dialog";
import { ProposalApproveDialog } from "@/components/proposal-approve-dialog";
import { RecordName } from "@/components/record-name";
import { Reveal } from "@/components/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import type { AttentionDetail, AttentionItem } from "@/lib/attention";
import { openProposalsOf } from "@/lib/attention";
import { unresolvedRequestsOf, unresolvedRequestsText } from "@/lib/external-requests";
import { nodePath } from "@/lib/node-path";
import { badgeVariantOf } from "@/lib/node-state";
import { relativeAge } from "@/lib/relative-age";

import { useDecisionActs } from "../use-decision-acts";
import { AssessmentPanel } from "./assessment-panel";
import { CauseText } from "./cause-text";

interface DecisionItemProps {
  readonly item: AttentionItem;
  readonly detail: AttentionDetail | null;
  readonly showProject: boolean;
  readonly now: number;
  readonly reload: () => void;
  readonly retryDetail: (nodeId: string) => void;
  readonly setDialogOpen: (nodeId: string, open: boolean) => void;
  readonly titleRef: (element: HTMLElement | null) => void;
}

export function DecisionItem({
  item,
  detail,
  showProject,
  now,
  reload,
  retryDetail,
  setDialogOpen,
  titleRef,
}: DecisionItemProps) {
  const { node } = item;
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const acts = useDecisionActs(item, detail, { reload, setDialogOpen });
  const blockedDetail = detail?.kind === "blocked" ? detail : null;
  const unresolved =
    detail?.kind === "paused" && detail.actions.status === "ready"
      ? unresolvedRequestsOf(detail.actions.data)
      : [];
  const proposals =
    item.kind === "blocked" && blockedDetail?.proposals.status === "ready"
      ? openProposalsOf(node, blockedDetail.proposals.data)
      : [];

  return (
    <Item variant="outline" size="sm" role="listitem">
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full">
          <Link
            ref={titleRef}
            to={nodePath(item.project.id, node.id)}
            className="break-words underline"
          >
            {node.content.name}
          </Link>
        </ItemTitle>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={badgeVariantOf(node.state)}>{node.state}</Badge>
          {item.cause !== null && <Badge variant="outline">{item.cause}</Badge>}
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
          <CauseText item={item} />
        </ItemDescription>
        {unresolved.length > 0 && (
          <ItemDescription className="line-clamp-none">
            {unresolvedRequestsText(node.attempt, unresolved)}
          </ItemDescription>
        )}
        {acts.waiting !== null && (
          <ItemDescription className="line-clamp-none">
            {acts.waiting}
            {acts.failed && (
              <>
                {" "}
                <Button variant="outline" size="sm" onClick={() => retryDetail(node.id)}>
                  Retry
                </Button>
              </>
            )}
          </ItemDescription>
        )}
        {item.kind === "blocked" && (
          <>
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
              <AssessmentPanel
                item={item}
                detail={blockedDetail}
                onRetry={() => retryDetail(node.id)}
              />
            </Reveal>
          </>
        )}
      </ItemContent>
      {acts.ready && (
        <ItemActions className="w-full flex-wrap justify-start md:w-auto md:justify-end">
          {item.kind === "blocked" && acts.unblock.available && (
            <Button variant="outline" size="sm" onClick={acts.unblock.request}>
              Unblock
            </Button>
          )}
          {proposals
            .filter((proposal) => acts.approve.canApprove(proposal))
            .map((proposal) => (
              <Button
                key={proposal.id}
                variant="outline"
                size="sm"
                aria-label={
                  proposals.length > 1 ? `Approve proposal ${proposal.content.name}` : undefined
                }
                onClick={() => acts.approve.request(proposal)}
              >
                Approve proposal
              </Button>
            ))}
          {acts.discard.available && (
            <Button variant="destructive" size="sm" onClick={acts.discard.request}>
              Discard
            </Button>
          )}
        </ItemActions>
      )}
      <NodeUnblockDialog name={node.content.name} unblock={acts.unblock} />
      <ProposalApproveDialog approve={acts.approve} />
      <NodeDiscardDialog name={node.content.name} discard={acts.discard} />
    </Item>
  );
}
