import { Button } from "@/components/ui/button";
import { utcDateTime } from "@/lib/format";
import { summaryOf } from "@/lib/workbench-chat";

export interface RunRequest {
  readonly text: string;
  readonly timestamp: number;
}

interface RunLineProps {
  readonly runActive: boolean;
  readonly busy: boolean;
  readonly ownerName: string;
  readonly request: RunRequest | null;
  readonly onStop: () => void;
}

export function RunLine({ runActive, busy, ownerName, request, onStop }: RunLineProps) {
  if (!runActive) return null;
  return (
    <div
      role="group"
      aria-label="Run line"
      className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground"
    >
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-primary" />
      <span>Running</span>
      {request !== null && (
        <span
          title={`This run: started by ${ownerName} at ${utcDateTime(request.timestamp)}`}
          className="min-w-0 truncate"
        >
          · {summaryOf(request.text)}
        </span>
      )}
      <Button variant="destructive" size="xs" disabled={busy} onClick={onStop}>
        Stop
      </Button>
    </div>
  );
}
