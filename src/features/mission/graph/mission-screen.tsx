import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { StateFilter } from "./components/state-filter";
import { TreeNodeRow } from "./components/tree-node";
import { useMissionGraph } from "./use-mission-graph";

function LoadingSkeleton() {
  return (
    <div className="space-y-3 p-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-4/5" />
      <Skeleton className="ml-6 h-5 w-3/4" />
      <Skeleton className="ml-6 h-5 w-2/3" />
      <Skeleton className="h-5 w-full" />
    </div>
  );
}

export function MissionScreen() {
  const graph = useMissionGraph();

  if (graph.loading) return <LoadingSkeleton />;

  if (graph.error !== null) {
    return (
      <div className="flex flex-col gap-2 p-4">
        <p className="text-sm text-destructive">{graph.error.message}</p>
        <Button variant="outline" size="sm" onClick={graph.reload}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">Mission</h1>
      <StateFilter
        activeStates={graph.activeStates}
        stateCounts={graph.stateCounts}
        onToggle={graph.toggleState}
        titleFilter={graph.titleFilter}
        onTitleFilter={graph.setTitleFilter}
      />
      <div className="divide-y divide-border rounded-md border">
        {graph.tree.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No nodes match the current filter.</p>
        ) : (
          <div className="p-2">
            {graph.tree.map((treeNode) => (
              <TreeNodeRow
                key={treeNode.node.id}
                treeNode={treeNode}
                nodeById={graph.nodeById}
                visibleIds={graph.visibleIds}
                depth={0}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
