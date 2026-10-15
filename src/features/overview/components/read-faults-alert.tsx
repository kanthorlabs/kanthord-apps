import { Fragment } from "react";

import { RecordName } from "@/components/record-name";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import type { ReadFault } from "../read-overview-snapshot";

interface ReadFaultsAlertProps {
  readonly faults: readonly ReadFault[];
  readonly onRetry: () => void;
}

export function ReadFaultsAlert({ faults, onRetry }: ReadFaultsAlertProps) {
  return (
    <Alert variant="destructive">
      <AlertDescription className="break-words">
        Some records could not be read:{" "}
        {faults.map((fault, index) => (
          <Fragment key={`${fault.projectId ?? "server"}-${fault.source}`}>
            {index > 0 && ", "}
            {fault.projectName !== null && (
              <>
                <RecordName>{fault.projectName}</RecordName>{" "}
              </>
            )}
            {fault.source} ({fault.message})
          </Fragment>
        ))}
        . The list can miss items.
      </AlertDescription>
      <div className="mt-2 flex md:justify-end">
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </div>
    </Alert>
  );
}
