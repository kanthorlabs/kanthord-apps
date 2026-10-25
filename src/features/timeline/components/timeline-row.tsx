import { itemKindOf, type TimelineRow as Row } from "@/lib/timeline-rows";

import { ActRow } from "./act-row";
import { ExecutionRow } from "./execution-row";
import { MissingRootRow } from "./missing-root-row";
import { SpanRow } from "./span-row";
import { TransitionRow } from "./transition-row";

interface TimelineRowProps {
  readonly row: Row;
  readonly nodeNameOf: ((nodeId: string | null) => string | null) | null;
}

function ItemRow({
  row,
  nodeNameOf,
}: TimelineRowProps & { readonly row: Exclude<Row, { kind: "missing_root" }> }) {
  const { item } = row;
  switch (itemKindOf(item)) {
    case "execution":
      return (
        <ExecutionRow
          item={item}
          nodeName={nodeNameOf === null ? null : nodeNameOf(item.node_id)}
        />
      );
    case "transition":
      return <TransitionRow item={item} />;
    case "act":
      return <ActRow item={item} />;
    case "span":
      return <SpanRow item={item} rootEnded={row.kind === "child" && row.rootEnded} />;
  }
}

export function TimelineRow({ row, nodeNameOf }: TimelineRowProps) {
  if (row.kind === "missing_root") return <MissingRootRow traceId={row.traceId} />;
  if (row.kind === "root") return <ItemRow row={row} nodeNameOf={nodeNameOf} />;
  return (
    <div role="presentation" className="ml-6">
      <ItemRow row={row} nodeNameOf={nodeNameOf} />
    </div>
  );
}
