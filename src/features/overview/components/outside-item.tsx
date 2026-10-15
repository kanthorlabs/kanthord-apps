import { useCallback } from "react";
import { Link } from "react-router-dom";

import { RecordName } from "@/components/record-name";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { useNodeCheck } from "@/hooks/use-node-check";
import type { AttentionDetail, OutsideAttentionItem } from "@/lib/attention";
import { deliveryText, mergeWaitText } from "@/lib/external-requests";
import { nodePath } from "@/lib/node-path";
import { badgeVariantOf } from "@/lib/node-state";
import { relativeAge } from "@/lib/relative-age";

import { CheckBadge } from "./check-badge";

interface OutsideItemProps {
  readonly item: OutsideAttentionItem;
  readonly detail: AttentionDetail | null;
  readonly showProject: boolean;
  readonly now: number;
  readonly reload: () => void;
  readonly markActed: (itemId: string) => void;
  readonly titleRef: (element: HTMLElement | null) => void;
}

function causeSentenceOf(item: OutsideAttentionItem, now: number): string {
  if (item.kind === "merge_wait") return mergeWaitText(item.request.evidence);
  return item.request.evidence === null
    ? "No end state arrived. Check the delivery."
    : deliveryText(item.request.action, item.request.evidence, now);
}

export function OutsideItem({
  item,
  detail,
  showProject,
  now,
  reload,
  markActed,
  titleRef,
}: OutsideItemProps) {
  const { node } = item;
  const actions =
    detail?.kind === "external" && detail.actions.status === "ready" ? detail.actions.data : null;
  const itemId = item.id;
  const acted = useCallback(() => markActed(itemId), [markActed, itemId]);
  const check = useNodeCheck(node, item.missionVersion, actions, reload, acted);

  return (
    <Item variant="outline" size="sm" role="listitem">
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full">
          <Link
            ref={titleRef}
            to={nodePath(item.project.id, node.id)}
            className="min-w-0 break-words underline"
          >
            {node.content.name}
          </Link>
        </ItemTitle>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={badgeVariantOf(node.state)}>{node.state}</Badge>
          <Badge variant="outline">{item.cause}</Badge>
          <CheckBadge label={check.label} />
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
        <ItemDescription className="line-clamp-none">{causeSentenceOf(item, now)}</ItemDescription>
      </ItemContent>
      {check.available && (
        <ItemActions className="w-full flex-wrap justify-start md:w-auto md:justify-end">
          <Button variant="outline" size="sm" disabled={check.checking} onClick={check.check}>
            Check now
          </Button>
        </ItemActions>
      )}
    </Item>
  );
}
