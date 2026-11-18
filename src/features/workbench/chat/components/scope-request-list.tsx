import { useState } from "react";

import type { ScopeRequest } from "@/api/types";
import { DataList } from "@/components/data-list";
import { DataListItem } from "@/components/data-list-item";
import { Button } from "@/components/ui/button";
import { useNow } from "@/features/traces/trace/use-now";
import { MINUTE_MS } from "@/lib/format";
import { requestAgeLineOf, requestedByLineOf, SCOPE_REQUEST_HELPER } from "@/lib/scope-request";
import { ScopeRequestDialog } from "./scope-request-dialog";

interface ScopeRequestListProps {
  readonly sessionId: string;
  readonly requests: readonly ScopeRequest[];
  readonly onResolved: (requestId: string) => void;
}

export function ScopeRequestList({ sessionId, requests, onResolved }: ScopeRequestListProps) {
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const now = useNow(true, MINUTE_MS);
  const open = requests.filter((request) => request.state === "open");
  const reviewing = open.find((request) => request.id === reviewingId);
  if (open.length === 0) return null;

  return (
    <section aria-labelledby="scope-requests-heading" className="flex min-w-0 flex-col gap-2">
      <h3 id="scope-requests-heading" className="font-semibold">
        Requests outside the shared projects
      </h3>
      <p className="text-sm text-muted-foreground">{SCOPE_REQUEST_HELPER}</p>
      <DataList
        label="Open requests"
        items={open}
        getKey={(request) => request.id}
        status="ready"
        error={null}
        pending={false}
        emptyText="No requests."
        renderItem={(request) => (
          <DataListItem
            title={requestedByLineOf(request)}
            description={requestAgeLineOf(request, now)}
            fields={[
              {
                label: "Operation",
                value: <span className="font-mono">{request.operation_id}</span>,
              },
              { label: "Target", value: <span className="font-mono">{request.target_id}</span> },
            ]}
            actions={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setReviewingId(request.id)}
              >
                Review
              </Button>
            }
          />
        )}
      />
      {reviewing !== undefined && (
        <ScopeRequestDialog
          key={reviewing.id}
          sessionId={sessionId}
          request={reviewing}
          onClose={() => setReviewingId(null)}
          onResolved={(requestId) => {
            setReviewingId(null);
            onResolved(requestId);
          }}
        />
      )}
    </section>
  );
}
