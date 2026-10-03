import type { NodeRevision } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Item, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";
import { relativeTime } from "@/lib/format";

interface RevisionsTabProps {
  readonly revisions: readonly NodeRevision[];
}

export function RevisionsTab({ revisions }: RevisionsTabProps) {
  if (revisions.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">No revisions yet.</p>;
  }

  const sorted = [...revisions].sort((a, b) => b.ordinal - a.ordinal);

  return (
    <div className="p-4">
      <ItemGroup aria-label="Revisions" className="gap-3">
        {sorted.map((rev) => (
          <Item key={rev.id} role="listitem" variant="outline" size="sm">
            <ItemContent className="min-w-0">
              <ItemTitle>Revision {rev.ordinal}</ItemTitle>
              <p className="text-sm break-words">{rev.reason}</p>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>Actor: {rev.actor}</span>
                <span>Created {relativeTime(rev.time)}</span>
                {rev.pinnedByAttempt !== null ? (
                  <span className="font-mono break-all">
                    pinned by attempt {rev.pinnedByAttempt}
                  </span>
                ) : (
                  <Badge variant="outline">not pinned by any attempt</Badge>
                )}
              </div>
            </ItemContent>
          </Item>
        ))}
      </ItemGroup>
    </div>
  );
}
