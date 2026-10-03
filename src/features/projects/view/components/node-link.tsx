import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { nameOf, type GraphModel } from "@/lib/mission-graph";
import { badgeVariantOf } from "@/lib/node-state";

interface NodeLinkProps {
  readonly model: GraphModel;
  readonly nodeId: string;
  readonly onSelect: (nodeId: string) => void;
}

export function NodeLink({ model, nodeId, onSelect }: NodeLinkProps) {
  const node = model.nodeById.get(nodeId);
  if (node === undefined) {
    return (
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-xs break-all">{nodeId}</span>
        <Badge variant="outline">not in the read</Badge>
      </span>
    );
  }
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1.5">
      <Button variant="link" size="sm" className="max-w-full" onClick={() => onSelect(nodeId)}>
        <span className="truncate">{nameOf(model, nodeId)}</span>
      </Button>
      {node.kind === "task" ? (
        <Badge variant="outline">task</Badge>
      ) : (
        <Badge variant={badgeVariantOf(node.state)}>{node.state}</Badge>
      )}
    </span>
  );
}
