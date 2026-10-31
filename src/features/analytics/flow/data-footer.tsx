import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import type { FlowRead } from "@/api/types";
import { awaitingOf, completenessOf, dataSignalOf } from "@/lib/flow-completeness";
import { countText, rateText } from "@/lib/flow-format";
import type { FlowFilters } from "@/lib/flow-query";
import { frameOf } from "@/lib/flow-status";

interface DataFooterProps {
  readonly read: FlowRead;
  readonly filters: Pick<FlowFilters, "range">;
}

interface ItemProps {
  readonly term: ReactNode;
  readonly termClassName?: string;
  readonly separated?: boolean;
  readonly children: ReactNode;
}

const COUNTING_RULE =
  "counted on claim day (UTC); Traces counts by overlap, so a drill count can differ · ◔ partial day · drops not shown";

function Item({ term, termClassName = "text-muted-foreground", separated, children }: ItemProps) {
  return (
    <div className={`flex gap-1 ${separated === true ? "md:border-l md:pl-4" : ""}`}>
      <dt className={termClassName}>{term}</dt> <dd>{children}</dd>
    </div>
  );
}

function AwaitingItem({
  awaiting,
  target,
}: {
  readonly awaiting: number;
  readonly target: string;
}) {
  const count = `${countText(awaiting)} →`;
  if (awaiting === 0) return <Item term="awaiting ingestion">{count}</Item>;
  return (
    <Item
      term={
        <>
          <span role="img" aria-label="warning">
            ⚠
          </span>{" "}
          awaiting ingestion
        </>
      }
    >
      <Link to={target} className="underline underline-offset-4">
        {count}
      </Link>
    </Item>
  );
}

export function DataFooter({ read, filters }: DataFooterProps) {
  const { completeness } = read;
  const { target } = dataSignalOf(read, frameOf(read, filters.range));
  return (
    <dl
      id="flow-data"
      tabIndex={-1}
      className="flex flex-wrap gap-x-4 gap-y-1 text-xs outline-none"
    >
      <Item term="Completeness">{rateText(completenessOf(read))}</Item>
      <Item term="no root">{countText(completeness.no_root)}</Item>
      <Item term="exit unknown">{countText(completeness.exit_unknown)}</Item>
      <AwaitingItem awaiting={awaitingOf(read)} target={target} />
      <Item term="open" separated>
        {countText(completeness.open)}
      </Item>
      <Item term="late records">{countText(completeness.late_records)}</Item>
      <Item term="Counting rule" termClassName="sr-only" separated>
        {COUNTING_RULE}
      </Item>
    </dl>
  );
}
