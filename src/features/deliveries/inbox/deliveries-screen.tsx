import { Link } from "react-router-dom";

import type { DeliveryDisposition } from "@/api/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DeliveryFilter, DeliveryGroup } from "./use-deliveries";
import { useDeliveries } from "./use-deliveries";

const FILTER_LABELS: Record<DeliveryFilter, string> = {
  all: "All",
  "acceptance as an observation": "Observations",
  "acceptance as a human act": "Human acts",
  refusal: "Refused",
  "a duplicate": "Duplicates",
};

const FILTERS: readonly DeliveryFilter[] = [
  "all",
  "acceptance as an observation",
  "acceptance as a human act",
  "refusal",
  "a duplicate",
];

function DispositionBadge({ disposition }: { disposition: DeliveryDisposition }) {
  const variants: Record<DeliveryDisposition, "default" | "secondary" | "destructive" | "outline"> =
    {
      "acceptance as an observation": "default",
      "acceptance as a human act": "secondary",
      refusal: "destructive",
      "a duplicate": "outline",
    };
  return <Badge variant={variants[disposition]}>{disposition}</Badge>;
}

function DeliveryGroupCard({ group }: { group: DeliveryGroup }) {
  const { primary, duplicates } = group;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <DispositionBadge disposition={primary.disposition} />
          <span className="font-mono text-xs text-muted-foreground">
            {primary.platformDeliveryIdentity}
          </span>
          <span className="text-xs text-muted-foreground">{primary.source}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {primary.decodedEventType !== null && (
          <p className="text-sm">
            <span className="text-muted-foreground">Event: </span>
            <span className="font-mono">{primary.decodedEventType}</span>
          </p>
        )}

        {primary.disposition === "refusal" && primary.refusalReason !== null && (
          <Alert variant="destructive">
            <AlertDescription>{primary.refusalReason}</AlertDescription>
          </Alert>
        )}

        {primary.nodeId !== null && (
          <div className="text-sm space-y-0.5">
            <p className="text-muted-foreground">Resolved to</p>
            <Link
              to={`/mission/${primary.nodeId}`}
              className="font-medium underline-offset-4 hover:underline"
            >
              {primary.nodeId}
            </Link>
            {primary.externalObjectId !== null && (
              <p className="text-muted-foreground">
                External object: <span className="font-mono">{primary.externalObjectId}</span>
              </p>
            )}
            {primary.attemptId !== null && (
              <p className="text-muted-foreground">
                Attempt: <span className="font-mono">{primary.attemptId}</span>
              </p>
            )}
          </div>
        )}

        {duplicates.length > 0 && (
          <div className="rounded-md border border-dashed p-3 space-y-1">
            {duplicates.map((dup) => (
              <div key={dup.id} className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="outline">a duplicate</Badge>
                <span className="text-muted-foreground">
                  received {new Date(dup.receivedAt).toLocaleTimeString()} — no second effect
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DeliveriesScreen() {
  const { resource, filter, setFilter, groups } = useDeliveries();

  return (
    <div className="grid gap-4">
      <Alert>
        <AlertDescription>
          Acceptance creates no claim, unblocks no node and starts no execution. Acceptance promises
          no execution.
        </AlertDescription>
      </Alert>

      <div className="overflow-x-auto">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as DeliveryFilter)}>
          <TabsList>
            {FILTERS.map((f) => (
              <TabsTrigger key={f} value={f}>
                {FILTER_LABELS[f]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {resource.loading && (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {!resource.loading && resource.error !== null && (
        <div className="space-y-2">
          <p className="text-sm text-destructive">{resource.error.message}</p>
          <Button variant="outline" size="sm" onClick={resource.reload}>
            Retry
          </Button>
        </div>
      )}

      {!resource.loading && resource.error === null && (
        <>
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deliveries.</p>
          ) : (
            <div className="grid gap-3">
              {groups.map((group) => (
                <DeliveryGroupCard key={group.primary.id} group={group} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
