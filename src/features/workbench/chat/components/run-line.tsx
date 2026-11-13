import { Button } from "@/components/ui/button";

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
      className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground"
    >
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-primary" />
      <span>Running</span>
      <Button variant="destructive" size="xs" disabled={busy} onClick={onStop}>
        Stop
      </Button>
    </div>
  );
}
