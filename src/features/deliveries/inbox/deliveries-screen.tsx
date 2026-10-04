import type { DeliveryDisposition } from "@/api/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemHeader } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { DeliveryFilter, DeliveryGroup } from "./use-deliveries";
import { DELIVERY_FILTERS, useDeliveries } from "./use-deliveries";

const FILTER_LABELS: Record<DeliveryFilter, string> = {
  all: "All",
  "acceptance as an observation": "Observations",
  "acceptance as a human act": "Human acts",
  refusal: "Refused",
  "a duplicate": "Duplicates",
};

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

function DeliveryGroupItem({ group }: { group: DeliveryGroup }) {
  const { primary, duplicates } = group;

  return (
    <Item variant="outline" role="listitem">
      <ItemHeader className="flex-wrap justify-start">
        <DispositionBadge disposition={primary.disposition} />
        <span className="font-mono text-xs text-muted-foreground">
          {primary.platformDeliveryIdentity}
        </span>
        <span className="text-xs text-muted-foreground">{primary.source}</span>
      </ItemHeader>
      <ItemContent className="min-w-0">
        {primary.decodedEventType !== null && (
          <ItemDescription className="line-clamp-none">
            Event: <span className="font-mono">{primary.decodedEventType}</span>
          </ItemDescription>
        )}

        {primary.disposition === "refusal" && primary.refusalReason !== null && (
          <Alert variant="destructive">
            <AlertDescription>{primary.refusalReason}</AlertDescription>
          </Alert>
        )}

        {primary.nodeId !== null && (
          <div className="space-y-0.5 text-sm">
            <p className="text-muted-foreground">Resolved to</p>
            <p className="font-medium">{primary.nodeId}</p>
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

        {duplicates.map((dup) => (
          <div key={dup.id} className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="outline">a duplicate</Badge>
            <span className="text-muted-foreground">
              received {new Date(dup.receivedAt).toLocaleTimeString()} — no second effect
            </span>
          </div>
        ))}
      </ItemContent>
    </Item>
  );
}

export function DeliveriesScreen() {
  const { resource, filter, selectFilter, groups } = useDeliveries();

  return (
    <div className="grid gap-4">
      <Alert>
        <AlertDescription>
          Acceptance creates no claim, unblocks no node and starts no execution. Acceptance promises
          no execution.
        </AlertDescription>
      </Alert>

      <ToggleGroup
        variant="outline"
        size="sm"
        spacing={2}
        value={[filter]}
        onValueChange={selectFilter}
        aria-label="Filter deliveries"
        className="w-full flex-wrap"
      >
        {DELIVERY_FILTERS.map((f) => (
          <ToggleGroupItem key={f} value={f}>
            {FILTER_LABELS[f]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

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
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No deliveries.</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <ItemGroup className="gap-3">
              {groups.map((group) => (
                <DeliveryGroupItem key={group.primary.id} group={group} />
              ))}
            </ItemGroup>
          )}
        </>
      )}
    </div>
  );
}
