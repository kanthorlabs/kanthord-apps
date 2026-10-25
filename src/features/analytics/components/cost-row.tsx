import { DataListItem } from "@/components/data-list-item";
import { Progress } from "@/components/ui/progress";
import type { CostRow as CostRowView } from "@/lib/analytics-cost-rows";

import { TracesLink } from "./traces-link";

export function CostRow({ row }: { readonly row: CostRowView }) {
  const bucket = row.bucketText === null ? "" : ` ${row.bucketText}`;
  return (
    <DataListItem
      title={row.title}
      description={row.bucketText ?? undefined}
      fields={row.fields}
      actions={row.tracesPath === null ? undefined : <TracesLink path={row.tracesPath} />}
      notice={
        <Progress
          value={row.cost}
          max={row.maxCost}
          aria-label={`Cost of ${row.title}${bucket}: ${row.costText}`}
        />
      }
    />
  );
}
