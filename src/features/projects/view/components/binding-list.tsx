import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import type { BindingReads } from "../settled-read";

interface BindingListProps {
  readonly label: string;
  readonly bindingIds: readonly string[];
  readonly reads: BindingReads;
}

export function BindingList({ label, bindingIds, reads }: BindingListProps) {
  if (bindingIds.length === 0) {
    return <p className="text-sm text-muted-foreground">The revision names no binding.</p>;
  }
  return (
    <ItemGroup aria-label={label}>
      {bindingIds.map((id) => {
        const read = reads.get(id);
        if (read === undefined || read.error !== null) {
          return (
            <Alert key={id} variant="destructive" role="listitem">
              <AlertDescription className="break-all">
                {id}: {read?.error.message ?? "The binding was not read."}
              </AlertDescription>
            </Alert>
          );
        }
        const binding = read.data;
        return (
          <Item key={id} variant="outline" size="sm" role="listitem">
            <ItemContent className="min-w-0">
              <ItemTitle className="w-full flex-wrap">
                <span className="font-mono break-all">{binding.name}</span>
                <Badge variant="outline">{binding.kind}</Badge>
                <Badge variant="secondary">revision {binding.revision}</Badge>
                {binding.removed_at !== null && <Badge variant="destructive">removed</Badge>}
              </ItemTitle>
              <ItemDescription className="break-all">{binding.resource_identity}</ItemDescription>
            </ItemContent>
          </Item>
        );
      })}
    </ItemGroup>
  );
}
