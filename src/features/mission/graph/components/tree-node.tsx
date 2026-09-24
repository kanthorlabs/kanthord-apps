import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import type { MissionNode } from "@/api/types";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { meaningOf, stateClasses } from "@/lib/node-state";

import type { TreeNode as TreeNodeData } from "../use-mission-graph";

interface DependencyOverlayProps {
  readonly node: MissionNode;
  readonly nodeById: ReadonlyMap<string, MissionNode>;
}

function DependencyOverlay({ node, nodeById }: DependencyOverlayProps) {
  if (node.dependsOn.length === 0) return null;

  return (
    <div className="mt-1 flex flex-wrap gap-1.5" aria-label="Depends on">
      <span className="text-xs text-muted-foreground">Depends on:</span>
      {node.dependsOn.map((depId) => {
        const dep = nodeById.get(depId);
        const title = dep?.title ?? depId;
        const completed = dep?.state === "Completed";
        return (
          <span
            key={depId}
            className={`inline-flex items-center rounded border px-1.5 py-0 text-xs font-medium ${
              completed
                ? "border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                : "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
            }`}
          >
            {title}
            {completed ? " ✓" : " (not Completed)"}
          </span>
        );
      })}
    </div>
  );
}

interface NodeRowProps {
  readonly treeNode: TreeNodeData;
  readonly nodeById: ReadonlyMap<string, MissionNode>;
  readonly visibleIds: ReadonlySet<string>;
  readonly depth: number;
}

export function TreeNodeRow({ treeNode, nodeById, visibleIds, depth }: NodeRowProps) {
  const { node, children } = treeNode;
  const [open, setOpen] = useState(true);

  if (!visibleIds.has(node.id)) return null;

  const indentClass = depth === 0 ? "" : depth === 1 ? "ml-4 sm:ml-6" : "ml-8 sm:ml-12";

  const isLeaf = node.kind === "task" || children.length === 0;

  const badge =
    node.state !== null ? (
      <span
        className={`mt-0.5 inline-flex shrink-0 items-center rounded border px-1.5 py-0 text-xs font-medium ${stateClasses(node.state)}`}
        title={meaningOf(node.state)}
      >
        {node.state}
      </span>
    ) : null;

  const kindBadge = (
    <span className="inline-flex shrink-0 items-center rounded border border-border bg-muted px-1.5 py-0 text-xs text-muted-foreground">
      {node.kind}
    </span>
  );

  const row = (
    <div className={`${indentClass} py-1.5`}>
      <div className="flex flex-wrap items-start gap-x-2 gap-y-0.5">
        {!isLeaf && (
          <CollapsibleTrigger
            className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={open ? "Collapse" : "Expand"}
          >
            {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </CollapsibleTrigger>
        )}
        <Link
          to={`/mission/${node.id}`}
          className="text-sm font-medium underline-offset-4 hover:underline"
        >
          {node.title}
        </Link>
        {kindBadge}
        {badge}
      </div>
      <DependencyOverlay node={node} nodeById={nodeById} />
    </div>
  );

  if (isLeaf) {
    return row;
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      {row}
      <CollapsibleContent>
        {children.map((child) => (
          <TreeNodeRow
            key={child.node.id}
            treeNode={child}
            nodeById={nodeById}
            visibleIds={visibleIds}
            depth={depth + 1}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
