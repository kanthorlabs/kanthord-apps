import { PlayIcon } from "lucide-react";
import { useCallback } from "react";
import { Link } from "react-router-dom";

import { RecordName } from "@/components/record-name";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { useProjectPause } from "@/hooks/use-project-pause";
import { fixTargetOf, spreadTextOf, type FixAttentionItem } from "@/lib/fix-attention";
import { badgeVariantOf } from "@/lib/node-state";
import { relativeAge } from "@/lib/relative-age";

import { FixCauseText } from "./fix-cause-text";

interface FixItemProps {
  readonly item: FixAttentionItem;
  readonly showProject: boolean;
  readonly now: number;
  readonly reload: () => void;
  readonly markActed: (itemId: string) => void;
  readonly titleRef: (element: HTMLElement | null) => void;
}

export function FixItem({ item, showProject, now, reload, markActed, titleRef }: FixItemProps) {
  const target = fixTargetOf(item);
  const spread = spreadTextOf(item);
  const itemId = item.id;
  const resumed = useCallback(() => {
    markActed(itemId);
    reload();
  }, [markActed, itemId, reload]);
  const pause = useProjectPause(item.project, resumed);

  return (
    <Item variant="outline" size="sm" role="listitem">
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full">
          <Link ref={titleRef} to={target.path} className="min-w-0 break-words underline">
            {item.subject}
          </Link>
        </ItemTitle>
        <div className="flex flex-wrap items-center gap-1.5">
          {item.kind === "no_taker" && (
            <Badge variant={badgeVariantOf(item.state)}>{item.state}</Badge>
          )}
          <Badge variant="outline">{item.cause}</Badge>
        </div>
        <ItemDescription className="line-clamp-none">
          {spread !== null && `${spread} · `}
          {spread === null && showProject && item.kind !== "project_paused" && (
            <>
              project <RecordName>{item.project.name}</RecordName> ·{" "}
            </>
          )}
          {item.at === null ? "age unknown" : relativeAge(item.at, now)}
        </ItemDescription>
        <ItemDescription className="line-clamp-none">
          <FixCauseText item={item} />
        </ItemDescription>
      </ItemContent>
      <ItemActions className="w-full flex-wrap justify-start md:w-auto md:justify-end">
        {item.kind === "project_paused" ? (
          <Button variant="outline" size="sm" disabled={pause.busy} onClick={pause.toggle}>
            <PlayIcon aria-hidden="true" data-icon="inline-start" />
            Resume project
          </Button>
        ) : (
          <Button
            nativeButton={false}
            render={<Link to={target.path} />}
            variant="outline"
            size="sm"
          >
            {target.label}
          </Button>
        )}
      </ItemActions>
    </Item>
  );
}
