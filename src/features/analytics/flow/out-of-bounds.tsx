import { OctagonAlert, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import type { FlowRead } from "@/api/types";
import { DataList } from "@/components/data-list";
import { DataListItem } from "@/components/data-list-item";
import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import type { FlowFilters } from "@/lib/flow-query";
import type { FlowSeverity } from "@/lib/flow-status";
import { frameOf } from "@/lib/flow-status";
import {
  type VerdictGroup,
  type VerdictLink,
  type VerdictRow,
  verdictsOf,
} from "@/lib/flow-verdicts";

interface OutOfBoundsProps {
  readonly read: FlowRead;
  readonly filters: Pick<FlowFilters, "range" | "projectId" | "workerName">;
}

const ICONS = {
  bad: { Icon: OctagonAlert, text: "Bad", tone: "text-flow-bad" },
  warn: { Icon: TriangleAlert, text: "Warning", tone: "text-flow-warn" },
} as const;

function VerdictIcon({ severity }: { readonly severity: FlowSeverity }) {
  if (severity === "ok") return null;
  const { Icon, text, tone } = ICONS[severity];
  return (
    <>
      <Icon aria-hidden="true" className={`inline size-4 align-text-bottom ${tone}`} />
      <span className="sr-only">{text}</span>{" "}
    </>
  );
}

function VerdictAction({ link }: { readonly link: VerdictLink }) {
  return (
    <Button nativeButton={false} variant="outline" size="sm" render={<Link to={link.target} />}>
      {link.label}
    </Button>
  );
}

function rowFields(row: VerdictRow) {
  return [
    { label: "Now", value: row.value },
    { label: "Bound", value: row.bound },
    { label: "Since", value: row.since },
    { label: "Slice", value: row.slice },
    { label: "Top cause", value: row.cause },
  ];
}

function RowItem({ row }: { readonly row: VerdictRow }) {
  const where =
    row.whereTarget === null ? (
      row.where
    ) : (
      <Link to={row.whereTarget} className="underline underline-offset-4">
        {row.where}
      </Link>
    );
  return (
    <DataListItem
      title={
        <>
          <VerdictIcon severity={row.severity} />
          {where} · {row.metric}
        </>
      }
      fields={rowFields(row)}
      actions={<VerdictAction link={row.link} />}
    />
  );
}

function GroupItem({ group }: { readonly group: VerdictGroup }) {
  return <DataListItem title={group.text} actions={<VerdictAction link={group.link} />} />;
}

export function OutOfBounds({ read, filters }: OutOfBoundsProps) {
  const [open, setOpen] = useState(false);
  const { range, projectId, workerName } = filters;
  const { rows, groups, days } = useMemo(
    () => verdictsOf(read, frameOf(read, range), { projectId, workerName }),
    [read, range, projectId, workerName],
  );
  const ongoing = rows.filter((row) => row.state === "ongoing").length;

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-base font-semibold">
        Out of bounds{" "}
        <span className="font-normal text-muted-foreground">
          {`${ongoing} ongoing · ${rows.length - ongoing} in range`}
        </span>
      </h3>
      {rows.length === 0 && groups.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {`✓ 6 stages, 8 tiles and causes within bounds · ${days}`}
        </p>
      )}
      {rows.length > 0 && (
        <DataList
          label="Out of bounds"
          items={rows}
          getKey={(row) => row.id}
          renderItem={(row) => <RowItem row={row} />}
          status="ready"
          error={null}
          pending={false}
          emptyText=""
        />
      )}
      {groups.length > 0 && (
        <div className="flex flex-col gap-2">
          <div>
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={open}
              onClick={() => setOpen((current) => !current)}
            >
              {`▸ Ended in range (${groups.length})`}
            </Button>
          </div>
          <Reveal open={open}>
            <DataList
              label="Ended in range"
              items={groups}
              getKey={(group) => group.key}
              renderItem={(group) => <GroupItem group={group} />}
              status="ready"
              error={null}
              pending={false}
              emptyText=""
            />
          </Reveal>
        </div>
      )}
    </section>
  );
}
