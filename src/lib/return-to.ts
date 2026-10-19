export interface ReturnToState {
  readonly return_to: string;
}

export function returnToState(path: string): ReturnToState {
  return { return_to: path };
}

const LOCAL_ORIGIN = "http://local.invalid";

function localPathOf(value: string): string | null {
  if (!value.startsWith("/")) return null;
  const url = new URL(value, LOCAL_ORIGIN);
  return url.origin === LOCAL_ORIGIN ? `${url.pathname}${url.search}${url.hash}` : null;
}

export function returnToOf(state: unknown): string | null {
  if (typeof state !== "object" || state === null || !("return_to" in state)) return null;
  const value = state.return_to;
  return typeof value === "string" ? localPathOf(value) : null;
}
