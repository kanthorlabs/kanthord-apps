import { toolNameOf } from "@/lib/tool-name";

interface GuestRunLineProps {
  readonly runActive: boolean;
  readonly waitingOperationId: string | null;
}

export function GuestRunLine({ runActive, waitingOperationId }: GuestRunLineProps) {
  if (!runActive) return null;
  return (
    <div
      role="group"
      aria-label="Run line"
      className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground"
    >
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-primary" />
      {waitingOperationId === null ? (
        <span>Running</span>
      ) : (
        <span className="min-w-0 break-words">
          Waiting for the owner to approve{" "}
          <code className="font-mono">{toolNameOf(waitingOperationId)}</code>
        </span>
      )}
    </div>
  );
}
