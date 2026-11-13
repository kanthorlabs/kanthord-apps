export function StatusLine({ text }: { readonly text: string }) {
  return (
    <p role="status" className="min-w-0 text-sm break-words text-muted-foreground">
      {text}
    </p>
  );
}
