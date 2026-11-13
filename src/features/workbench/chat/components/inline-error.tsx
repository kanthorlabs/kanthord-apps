interface InlineErrorProps {
  readonly id?: string;
  readonly code: string | null;
  readonly message: string;
}

export function InlineError({ id, code, message }: InlineErrorProps) {
  return (
    <p id={id} role="alert" className="min-w-0 text-sm break-words text-destructive">
      {code !== null && <code className="font-mono">{code}</code>}
      {code !== null && " "}
      <span>{message}</span>
    </p>
  );
}
