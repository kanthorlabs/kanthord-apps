import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";

interface RunLineProps {
  readonly runActive: boolean;
  readonly busy: boolean;
  readonly onStop: () => void;
}

export function RunLine({ runActive, busy, onStop }: RunLineProps) {
  if (!runActive) return null;
  return (
    <div
      role="group"
      aria-label="Run line"
      className="flex items-center gap-2 text-sm text-muted-foreground"
    >
      <span>Running</span>
      <Button variant="outline" size="sm" disabled={busy} onClick={onStop}>
        Stop
      </Button>
    </div>
  );
}

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
  return (
    <Card size="sm" role="alertdialog" aria-label="Stop the run?" className="mb-2 ring-destructive">
      <CardHeader>
        <h3 className="leading-none font-semibold text-destructive">Stop the run?</h3>
      </CardHeader>
      <CardContent className="text-sm">
        <p>
          <span>{queuedLine(count)}</span>
          {hasDraft && " "}
          {hasDraft && <span>Your draft sends next.</span>}
        </p>
      </CardContent>
      <CardFooter className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        {hasDraft && (
          <Button type="button" variant="destructive" disabled={busy} onClick={onStopAndSend}>
            Stop &amp; send draft
          </Button>
        )}
        <Button type="button" variant="destructive" disabled={busy} onClick={onStop}>
          Stop
        </Button>
      </CardFooter>
    </Card>
  );
}
