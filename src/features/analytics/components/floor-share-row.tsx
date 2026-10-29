import { DataListItem } from "@/components/data-list-item";
import { Progress } from "@/components/ui/progress";
import type { FloorShareRow as FloorShareRowView } from "@/lib/analytics-time-rows";

import { TracesLink } from "./traces-link";

export function FloorShareRow({ row }: { readonly row: FloorShareRowView }) {
  return (
    <DataListItem
      title={row.title}
      description={row.bucketText ?? undefined}
      fields={row.fields}
      actions={row.tracesPath === null ? undefined : <TracesLink path={row.tracesPath} />}
      notice={<Progress value={row.share} max={1} aria-label={row.barLabel} />}
    />
  );
}
