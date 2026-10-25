import type { TimelineItem } from "@/api/types";
import { DataListItem } from "@/components/data-list-item";
import { utcDateTime } from "@/lib/format";
import { spanDetail, spanLabel } from "@/lib/span-labels";

interface TransitionRowProps {
  readonly item: TimelineItem;
}

export function TransitionRow({ item }: TransitionRowProps) {
  const detail = spanDetail(item);
  const at = item.start_time ?? item.created_at;
  return (
    <DataListItem
      title={spanLabel(item)}
      description={detail ?? undefined}
      fields={[{ label: "Time", value: utcDateTime(at) }]}
    />
  );
}
