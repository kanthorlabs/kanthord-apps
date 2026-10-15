import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
        {failure === null
          ? `${components.join(", ")}. Operate the host.`
          : `The liveness of the daemon could not be read: ${failure}`}
      </AlertDescription>
    </Alert>
  );
}
