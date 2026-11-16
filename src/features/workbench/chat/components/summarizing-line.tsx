import { Button } from "@/components/ui/button";

interface SummarizingLineProps {
  readonly onCancel: () => void;
}

export function SummarizingLine({ onCancel }: SummarizingLineProps) {
  return (
    <div
      role="group"
      aria-label="Summarizing line"
      className="flex min-w-0 items-center gap-2 pb-1 text-sm text-muted-foreground"
    >
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-primary" />
      <span>Summarizing…</span>
      <Button variant="link" size="xs" className="ml-auto shrink-0" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}
