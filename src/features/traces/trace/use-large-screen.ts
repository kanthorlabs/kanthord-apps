import { useSyncExternalStore } from "react";

const LARGE_SCREEN_QUERY = "(min-width: 64rem)";

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(LARGE_SCREEN_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function snapshot(): boolean {
  return window.matchMedia(LARGE_SCREEN_QUERY).matches;
}

export function useLargeScreen(): boolean {
  return useSyncExternalStore(subscribe, snapshot);
}
