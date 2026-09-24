import type { NodeRevision } from "@/api/types";
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
    <div className="space-y-3 p-4">
      {sorted.map((rev) => (
        <div key={rev.id} className="rounded-md border p-3 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">Revision {rev.ordinal}</span>
            {rev.pinnedByAttempt !== null ? (
              <span className="text-xs text-muted-foreground font-mono">
                pinned by attempt {rev.pinnedByAttempt}
              </span>
            ) : (
              <span className="text-xs text-amber-700 dark:text-amber-400">
                not pinned by any attempt
              </span>
            )}
          </div>
          <p className="text-sm">{rev.reason}</p>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>Actor: {rev.actor}</span>
            <span>{relativeTime(rev.time)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
