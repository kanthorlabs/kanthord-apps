import { Button } from "@/components/ui/button";
import { utcDateTime } from "@/lib/format";
import type { ChatItem } from "@/lib/workbench-chat";

interface RunLineProps {
  readonly runActive: boolean;
  readonly request: Extract<ChatItem, { kind: "user" }> | null;
  readonly ownerName: string;
  readonly busy: boolean;
  readonly onStop: () => void;
}

export function RunLine({ runActive, request, ownerName, busy, onStop }: RunLineProps) {
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
          · {request.text}
        </span>
      )}
      <Button
        variant="link"
        size="xs"
        className="ml-auto shrink-0 text-destructive"
        disabled={busy}
        onClick={onStop}
      >
        Stop
      </Button>
    </div>
  );
}
