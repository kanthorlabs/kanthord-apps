import type { TimelineItem } from "@/api/types";
import { DataListItem } from "@/components/data-list-item";
import { durationText } from "@/lib/format";
import { spanLabel } from "@/lib/span-labels";

interface SpanRowProps {
  readonly item: TimelineItem;
}

export function SpanRow({ item }: SpanRowProps) {
  return (
    <DataListItem
      title={spanLabel(item)}
      fields={[
        {
          label: "Duration",
          value: item.duration_ms === null ? "running" : durationText(item.duration_ms),
        },
      ]}
    />
  );
}
