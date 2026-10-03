import type { DependencyClosure } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Item, ItemActions, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";
import { badgeVariantOf } from "@/lib/node-state";

interface DependenciesTabProps {
  readonly closure: DependencyClosure;
}

export function DependenciesTab({ closure }: DependenciesTabProps) {
  return (
    <div className="space-y-4 p-4">
      <div className="rounded-md border p-3">
        <p className="text-sm">
          The dependency closure gates the transition from{" "}
          <span className="font-semibold">Pending</span> to{" "}
          <span className="font-semibold">Available</span>. The closure holds when every member is{" "}
          <span className="font-semibold">Completed</span>. A{" "}
          <span className="font-semibold">Discarded</span> member satisfies no dependency. An
          unsatisfied dependency makes the node unavailable; it does not block the node.
        </p>
        <p className="mt-2 text-sm font-semibold">
          Closure status:{" "}
          <Badge variant={closure.holds ? "secondary" : "outline"}>
            {closure.holds ? "holds" : "does not hold"}
          </Badge>
        </p>
      </div>

      {closure.members.length === 0 ? (
        <p className="text-sm text-muted-foreground">No dependency members.</p>
      ) : (
        <ItemGroup aria-label="Dependency members" className="gap-2">
          {closure.members.map((member) => (
            <Item key={member.nodeId} role="listitem" variant="outline" size="sm">
              <ItemContent className="min-w-0">
                <ItemTitle>{member.title}</ItemTitle>
              </ItemContent>
              <ItemActions>
                {member.state !== null ? (
                  <Badge variant={badgeVariantOf(member.state)}>{member.state}</Badge>
                ) : (
                  <Badge variant="outline">task</Badge>
                )}
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      )}
    </div>
  );
}
