export function GuestRunLine({ runActive }: { readonly runActive: boolean }) {
  if (!runActive) return null;
  return (
    <div
      role="group"
      aria-label="Run line"
      className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground"
    >
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-primary" />
      <span>Running</span>
    </div>
  );
}
