import { DataListItem } from "@/components/data-list-item";
import type { TimeRow as TimeRowView } from "@/lib/analytics-time-rows";

import { PercentileBar } from "./percentile-bar";
import { TracesLink } from "./traces-link";

export function TimeRow({ row }: { readonly row: TimeRowView }) {
  return (
    <DataListItem
      title={row.title}
      description={row.bucketText ?? undefined}
      fields={row.fields}
      actions={row.tracesPath === null ? undefined : <TracesLink path={row.tracesPath} />}
      notice={
        <PercentileBar max={row.max} scale={row.scale} marks={row.marks} label={row.barLabel} />
      }
    />
  );
}
