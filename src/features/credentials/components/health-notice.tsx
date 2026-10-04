import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { utcDateTime } from "@/lib/format";
import type { CredentialHealthState } from "../use-credential-health";

interface HealthNoticeProps {
  readonly state: CredentialHealthState;
  readonly onVerify: () => void;
}

export function HealthNotice({ state, onVerify }: HealthNoticeProps) {
  if (state.status === "checking") {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Checking. The health report can take up to 2 minutes.
      </p>
    );
  }
  if (state.status === "failed") {
    return (
      <Alert variant="destructive">
        <AlertTitle>The health report failed.</AlertTitle>
        <AlertDescription>{state.message}</AlertDescription>
        <AlertAction>
          <Button variant="outline" size="sm" onClick={onVerify}>
            Retry
          </Button>
        </AlertAction>
      </Alert>
    );
  }
  if (state.status === "ready") {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Health checked at {utcDateTime(state.checkedAt)}.
      </p>
    );
  }
  return null;
}
