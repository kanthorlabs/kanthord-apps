const LINE_BREAK = /\r?\n/;

export function commandLineOf(args: unknown): string | null {
  if (typeof args !== "object" || args === null || !("command" in args)) return null;
  const { command } = args;
  return typeof command === "string" ? (command.split(LINE_BREAK)[0] ?? null) : null;
}
