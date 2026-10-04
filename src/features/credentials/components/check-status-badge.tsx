import { Loader2Icon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { CheckBadge } from "../use-credential-check";

export function CheckStatusBadge({ badge }: { badge: CheckBadge | null }) {
  return (
    <span role="status" className="inline-flex">
      {badge !== null && (
        <Badge variant={badge.variant}>
          {badge.busy && (
            <Loader2Icon aria-hidden="true" data-icon="inline-start" className="animate-spin" />
          )}
          {badge.label}
        </Badge>
      )}
    </span>
  );
}
