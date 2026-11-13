import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export interface StopConfirmProps {
  readonly count: number;
  readonly hasDraft: boolean;
  readonly busy: boolean;
  readonly onStop: () => void;
  readonly onStopAndSend: () => void;
  readonly onCancel: () => void;
}

function queuedLine(count: number): string {
  return count === 1
    ? "Your 1 queued message returns to the composer."
    : `Your ${count} queued messages return to the composer.`;
}

export function StopConfirm({
  count,
  hasDraft,
  busy,
  onStop,
  onStopAndSend,
  onCancel,
}: StopConfirmProps) {
  const title = "Stop the run?";
  return (
    <Alert variant="destructive" role="alertdialog" aria-label={title} className="mb-2">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p>
          <span>{queuedLine(count)}</span>
          {hasDraft && " "}
          {hasDraft && <span>Your draft sends next.</span>}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="destructive"
            disabled={busy}
            onClick={hasDraft ? onStopAndSend : onStop}
          >
            {hasDraft ? "Stop & send draft" : "Stop"}
          </Button>
          <Button type="button" variant="link" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
