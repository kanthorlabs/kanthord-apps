import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import {
  approvalChatPathOf,
  approvalFactOf,
  type ToolApprovalItem,
} from "@/lib/approval-attention";
import { relativeAge } from "@/lib/relative-age";

interface ApprovalItemProps {
  readonly item: ToolApprovalItem;
  readonly now: number;
  readonly titleRef: (element: HTMLElement | null) => void;
}

export function ApprovalItem({ item, now, titleRef }: ApprovalItemProps) {
  const chatPath = approvalChatPathOf(item);

  return (
    <Item variant="outline" size="sm" role="listitem">
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full">
          <Link ref={titleRef} to={chatPath} className="line-clamp-3 min-w-0 break-words underline">
            {item.subject}
          </Link>
        </ItemTitle>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{item.agent}</Badge>
          <Badge variant="outline">Waits for approval</Badge>
        </div>
        <ItemDescription className="line-clamp-none break-words">
          {approvalFactOf(item)} · {relativeAge(item.at, now)}
        </ItemDescription>
      </ItemContent>
      <ItemActions className="w-full flex-wrap justify-start md:w-auto md:justify-end">
        <Button nativeButton={false} render={<Link to={chatPath} />} variant="outline" size="sm">
          Open chat
        </Button>
      </ItemActions>
    </Item>
  );
}
