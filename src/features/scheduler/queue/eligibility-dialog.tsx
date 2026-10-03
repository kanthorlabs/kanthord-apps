import { CheckCircleIcon, XCircleIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";

import { useEligibility } from "./use-eligibility";

interface Props {
  readonly nodeId: string;
  readonly nodeTitle: string;
  readonly onClose: () => void;
}

export function EligibilityDialog({ nodeId, nodeTitle, onClose }: Props) {
  const eligibility = useEligibility(nodeId);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Admission conditions for &ldquo;{nodeTitle}&rdquo;</DialogTitle>
          <DialogDescription>
            Failing conditions come first. The Scheduler rechecks every condition at the claim.
          </DialogDescription>
        </DialogHeader>

        {eligibility.loading && (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        )}

        {eligibility.error !== null && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-destructive">{eligibility.error.message}</p>
            <Button variant="outline" size="sm" onClick={eligibility.reload}>
              Retry
            </Button>
          </div>
        )}

        {!eligibility.loading && eligibility.error === null && !eligibility.hasChecks && (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>The daemon reports no admission conditions.</EmptyTitle>
            </EmptyHeader>
          </Empty>
        )}

        {!eligibility.loading && eligibility.error === null && eligibility.hasChecks && (
          <ItemGroup aria-label="Admission conditions" className="gap-2">
            {eligibility.failingFirst.map((check) => (
              <Item
                key={check.name}
                role="listitem"
                variant={check.holds ? "outline" : "muted"}
                size="sm"
              >
                <ItemMedia>
                  {check.holds ? (
                    <CheckCircleIcon aria-hidden="true" />
                  ) : (
                    <XCircleIcon aria-hidden="true" />
                  )}
                </ItemMedia>
                <ItemContent className="min-w-0">
                  <ItemTitle>{check.name}</ItemTitle>
                  <p className="text-sm text-muted-foreground">{check.detail}</p>
                </ItemContent>
                <ItemActions>
                  {check.holds ? (
                    <Badge variant="secondary">Pass</Badge>
                  ) : (
                    <Badge variant="destructive">Fail</Badge>
                  )}
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        )}
      </DialogContent>
    </Dialog>
  );
}
