import { DataListItem } from "@/components/data-list-item";
import type { TimeRow as TimeRowView } from "@/lib/analytics-time-rows";

import { PercentileBar } from "./percentile-bar";

export function TimeRow({ row }: { readonly row: TimeRowView }) {
  return (
    <DataListItem
      title={row.title}
      description={row.bucketText ?? undefined}
      fields={row.fields}
      notice={
        <PercentileBar max={row.max} scale={row.scale} marks={row.marks} label={row.barLabel} />
      }
    />
  );
}
