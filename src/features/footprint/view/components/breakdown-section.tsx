import { Link } from "react-router-dom";

import type { FootprintTable } from "@/api/types";
import { DataList } from "@/components/data-list";
import { DataListItem } from "@/components/data-list-item";
import { byteText, utcDateTime } from "@/lib/format";
import { TABLE_OWNER_TEXTS } from "@/lib/footprint";

const EVIDENCE_DELETE = "mission.evidence.delete";

function OwnerPath({ operation }: { operation: string }) {
  const text = TABLE_OWNER_TEXTS[operation] ?? `Delete its records through ${operation}.`;
  return (
    <p className="text-sm text-muted-foreground">
      {text}
      {operation === EVIDENCE_DELETE && (
        <>
          {" "}
          <Link to="/projects">Open Projects</Link>
        </>
      )}
    </p>
  );
}

export function BreakdownSection({ tables }: { tables: readonly FootprintTable[] }) {
  return (
    <section aria-labelledby="footprint-breakdown" className="flex flex-col gap-3">
      <h3 id="footprint-breakdown" className="font-semibold leading-none">
        Breakdown
      </h3>
      <DataList
        label="Tables"
        items={tables}
        getKey={(table) => table.name}
        renderItem={(table) => (
          <DataListItem
            title={<span className="font-mono">{table.name}</span>}
            fields={[
              {
                label: "Size",
                value: table.bytes === null ? "Not measured" : byteText(table.bytes),
              },
              ...(table.oldest_at === null
                ? []
                : [{ label: "Oldest", value: utcDateTime(table.oldest_at) }]),
            ]}
            notice={
              table.delete_operation === null ? undefined : (
                <OwnerPath operation={table.delete_operation} />
              )
            }
          />
        )}
        status="ready"
        error={null}
        pending={false}
        emptyText="No table."
      />
    </section>
  );
}
