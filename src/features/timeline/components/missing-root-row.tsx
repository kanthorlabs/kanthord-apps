import { DataListItem } from "@/components/data-list-item";
import { Badge } from "@/components/ui/badge";

import { OpenTraceButton } from "./open-trace-button";

interface MissingRootRowProps {
  readonly traceId: string;
}

export function MissingRootRow({ traceId }: MissingRootRowProps) {
  return (
    <DataListItem
      title={`Trace ${traceId}`}
      status={<Badge variant="outline">root not stored</Badge>}
      actions={<OpenTraceButton traceId={traceId} />}
    />
  );
}
