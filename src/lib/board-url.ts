import { BOARD_TABS, type BoardTabId } from "./board-tabs";

export interface BoardUrlState {
  readonly project: string | null;
  readonly kind: BoardTabId | null;
  readonly item: string | null;
}

function valueOf(params: URLSearchParams, key: string): string | null {
  const value = params.get(key);
  return value === null || value === "" ? null : value;
}

function kindOf(value: string | null): BoardTabId | null {
  return BOARD_TABS.find((tab) => tab.id === value)?.id ?? null;
}

function setOrDrop(params: URLSearchParams, key: string, value: string | null): void {
  if (value === null) params.delete(key);
  else params.set(key, value);
}

export function boardUrlOf(params: URLSearchParams): BoardUrlState {
  return {
    project: valueOf(params, "project"),
    kind: kindOf(valueOf(params, "kind")),
    item: valueOf(params, "item"),
  };
}

export function boardParamsOf(current: URLSearchParams, state: BoardUrlState): URLSearchParams {
  const next = new URLSearchParams(current);
  setOrDrop(next, "project", state.project);
  setOrDrop(next, "kind", state.kind);
  setOrDrop(next, "item", state.item);
  return next;
}
