export interface ReturnToState {
  readonly return_to: string;
}

export function returnToState(path: string): ReturnToState {
  return { return_to: path };
}

function isLocalPath(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\");
}

export function returnToOf(state: unknown): string | null {
  if (typeof state !== "object" || state === null || !("return_to" in state)) return null;
  const value = state.return_to;
  return typeof value === "string" && isLocalPath(value) ? value : null;
}
