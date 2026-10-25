import type { TimelineItem } from "@/api/types";
import { DataListItem } from "@/components/data-list-item";
import { Badge } from "@/components/ui/badge";
import { spanLabel } from "@/lib/span-labels";
import { spanDurationText } from "@/lib/timeline-rows";

interface SpanRowProps {
  readonly item: TimelineItem;
  readonly rootEnded: boolean;
}

export function SpanRow({ item, rootEnded }: SpanRowProps) {
  return (
    <DataListItem
      title={spanLabel(item)}
      status={item.status === "Error" ? <Badge variant="destructive">Error</Badge> : undefined}
      fields={[
        {
          label: "Duration",
          value: spanDurationText(item, rootEnded),
        },
      ]}
    />
  );
}
