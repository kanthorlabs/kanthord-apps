import { CheckCircleIcon, XCircleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
          <DialogTitle>Why is &ldquo;{nodeTitle}&rdquo; not running?</DialogTitle>
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
          <p className="text-sm text-muted-foreground">The daemon reports no checks.</p>
        )}

        {!eligibility.loading && eligibility.error === null && eligibility.hasChecks && (
          <ul className="space-y-2" aria-label="Eligibility checks">
            {eligibility.failingFirst.map((check) => (
              <li
                key={check.name}
                className={`flex gap-3 rounded-md p-2 ${check.holds ? "" : "bg-destructive/10"}`}
              >
                {check.holds ? (
                  <CheckCircleIcon
                    className="mt-0.5 size-4 shrink-0 text-green-600"
                    aria-hidden="true"
                  />
                ) : (
                  <XCircleIcon
                    className="mt-0.5 size-4 shrink-0 text-destructive"
                    aria-hidden="true"
                  />
                )}
                <div>
                  <p
                    className={`text-sm font-medium ${check.holds ? "" : "text-destructive"}`}
                    aria-label={check.holds ? `Pass: ${check.name}` : `Fail: ${check.name}`}
                  >
                    {check.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{check.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
