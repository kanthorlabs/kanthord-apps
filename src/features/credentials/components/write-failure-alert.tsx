import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { WriteFailure } from "../write-failure";

interface WriteFailureAlertProps {
  readonly title: string;
  readonly failure: WriteFailure;
  readonly onReload: () => void;
}

export function WriteFailureAlert({ title, failure, onReload }: WriteFailureAlertProps) {
  return (
    <Alert variant="destructive">
      <AlertTitle>{failure.conflict ? "The credential changed." : title}</AlertTitle>
      <AlertDescription>{failure.message}</AlertDescription>
      {failure.conflict && (
        <AlertAction>
          <Button variant="outline" size="sm" onClick={onReload}>
            Reload
          </Button>
        </AlertAction>
      )}
    </Alert>
  );
}
