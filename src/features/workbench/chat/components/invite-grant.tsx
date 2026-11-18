import { ChevronDownIcon } from "lucide-react";

import type { GrantedOperation } from "@/api/types";
import { RevealPanel } from "@/components/reveal";
import { TouchTarget } from "@/components/touch-target";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import { grantSummaryOf } from "@/lib/share-invite";

const EMPTY_GRANT = "Approval for every act";

interface GrantIdsProps {
  readonly granted: readonly GrantedOperation[];
  readonly label: string;
}

function GrantIds({ granted, label }: GrantIdsProps) {
  return (
    <ul aria-label={label} className="flex min-w-0 flex-col gap-1 text-sm">
      {granted.map((operation) => (
        <li key={operation.operation_id} className="min-w-0 break-all">
          <code className="font-mono">{operation.operation_id}</code>{" "}
          <span className="text-muted-foreground">{operation.guard_class}</span>
        </li>
      ))}
    </ul>
  );
}

export function InviteGrant({ granted }: { readonly granted: readonly GrantedOperation[] }) {
  const summary = grantSummaryOf(granted);
  if (summary === null) return <p className="text-sm text-muted-foreground">{EMPTY_GRANT}</p>;
  return (
    <Collapsible className="flex min-w-0 flex-col gap-2">
      <TouchTarget>
        <CollapsibleTrigger render={<Button variant="outline" size="sm" className="self-start" />}>
          <ChevronDownIcon aria-hidden="true" data-icon="inline-start" />
          {summary}
        </CollapsibleTrigger>
      </TouchTarget>
      <RevealPanel>
        <GrantIds granted={granted} label="Acts without approval" />
      </RevealPanel>
    </Collapsible>
  );
}

export function CreatedGrant({ granted }: { readonly granted: readonly GrantedOperation[] }) {
  const summary = grantSummaryOf(granted);
  return (
    <section aria-label="Grant of this link" className="flex min-w-0 flex-col gap-2">
      <p className="text-sm">{summary ?? EMPTY_GRANT}</p>
      {summary !== null && (
        <GrantIds granted={granted} label="Acts of this link without approval" />
      )}
    </section>
  );
}
