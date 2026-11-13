import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { healthMessageOf } from "@/lib/board-pane-text";

interface SystemHealthAlertProps {
  readonly components: readonly string[];
  readonly failure: string | null;
}

export function SystemHealthAlert({ components, failure }: SystemHealthAlertProps) {
  if (components.length === 0 && failure === null) return null;
  return (
    <Alert variant="destructive">
      <AlertTitle>The daemon reports a fault.</AlertTitle>
      <AlertDescription className="break-words">
        {healthMessageOf(components, failure)}
      </AlertDescription>
    </Alert>
  );
}
