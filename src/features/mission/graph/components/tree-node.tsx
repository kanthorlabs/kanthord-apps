import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import type { MissionNode } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Item, ItemContent, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { badgeVariantOf } from "@/lib/node-state";

import type { TreeNode as TreeNodeData } from "../use-mission-graph";

interface DependencyOverlayProps {
  readonly node: MissionNode;
  readonly nodeById: ReadonlyMap<string, MissionNode>;
}

function DependencyOverlay({ node, nodeById }: DependencyOverlayProps) {
  if (node.dependsOn.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Depends on">
      <span className="text-xs text-muted-foreground">Depends on:</span>
      {node.dependsOn.map((depId) => {
        const dep = nodeById.get(depId);
        const title = dep?.title ?? depId;
        const completed = dep?.state === "Completed";
        return (
          <Badge key={depId} variant={completed ? "secondary" : "outline"}>
            {title}
            {completed ? " ✓" : " (not Completed)"}
          </Badge>
        );
      })}
    </div>
  );
}

interface NodeRowProps {
  readonly treeNode: TreeNodeData;
  readonly nodeById: ReadonlyMap<string, MissionNode>;
  readonly visibleIds: ReadonlySet<string>;
}

export function TreeNodeRow({ treeNode, nodeById, visibleIds }: NodeRowProps) {
  const { node, children } = treeNode;
  const [open, setOpen] = useState(true);

  if (!visibleIds.has(node.id)) return null;

  const isLeaf = node.kind === "task" || children.length === 0;

  const row = (
    <Item size="sm" className="flex-nowrap items-start">
      {!isLeaf && (
        <ItemMedia>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={open ? "Collapse" : "Expand"}>
              {open ? <ChevronDown /> : <ChevronRight />}
            </Button>
          </CollapsibleTrigger>
        </ItemMedia>
      )}
      <ItemContent className="min-w-0">
        <ItemTitle>
          <Link
            to={`/mission/${node.id}`}
            className="break-words underline-offset-4 hover:underline"
          >
            {node.title}
          </Link>
        </ItemTitle>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline">{node.kind}</Badge>
          {node.state !== null && <Badge variant={badgeVariantOf(node.state)}>{node.state}</Badge>}
        </div>
        <DependencyOverlay node={node} nodeById={nodeById} />
      </ItemContent>
    </Item>
  );

  if (isLeaf) {
    return <div role="listitem">{row}</div>;
  }

  return (
    <Collapsible role="listitem" open={open} onOpenChange={setOpen}>
      {row}
      <CollapsibleContent>
        <ItemGroup className="ml-4 sm:ml-6">
          {children.map((child) => (
            <TreeNodeRow
              key={child.node.id}
              treeNode={child}
              nodeById={nodeById}
              visibleIds={visibleIds}
            />
          ))}
        </ItemGroup>
      </CollapsibleContent>
    </Collapsible>
  );
}
