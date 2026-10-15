import { RefreshCwIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isStale, relativeAge } from "@/lib/relative-age";

interface RefreshStatusProps {
  readonly updatedAt: number | null;
  readonly now: number;
  readonly onRefresh: () => void;
}

export function RefreshStatus({ updatedAt, now, onRefresh }: RefreshStatusProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 md:justify-end">
      {updatedAt !== null && (
        <span className="text-sm text-muted-foreground">Updated {relativeAge(updatedAt, now)}</span>
      )}
      {updatedAt !== null && isStale(updatedAt, now) && <Badge variant="outline">Stale</Badge>}
      <Button variant="outline" size="sm" onClick={onRefresh}>
        <RefreshCwIcon aria-hidden="true" data-icon="inline-start" />
        Refresh
      </Button>
    </div>
  );
}
