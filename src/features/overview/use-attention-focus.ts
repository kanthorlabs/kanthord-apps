import { useCallback, useEffect, useRef } from "react";

import type { AttentionItem } from "@/lib/attention";

interface PendingHandoff {
  readonly itemId: string;
  readonly index: number;
  readonly readAt: number | null;
}

export interface AttentionFocus {
  readonly titleRef: (itemId: string) => (element: HTMLElement | null) => void;
  readonly allClearRef: (element: HTMLElement | null) => void;
  readonly markActed: (itemId: string) => void;
}

export function useAttentionFocus(
  items: readonly AttentionItem[],
  updatedAt: number | null,
): AttentionFocus {
  const titles = useRef(new Map<string, HTMLElement>());
  const allClear = useRef<HTMLElement | null>(null);
  const pending = useRef<PendingHandoff | null>(null);
  const shown = useRef(items);
  const readAt = useRef(updatedAt);

  const titleRef = useCallback(
    (itemId: string) => (element: HTMLElement | null) => {
      if (element === null) titles.current.delete(itemId);
      else titles.current.set(itemId, element);
    },
    [],
  );

  const allClearRef = useCallback((element: HTMLElement | null) => {
    allClear.current = element;
  }, []);

  const markActed = useCallback((itemId: string) => {
    const index = shown.current.findIndex((item) => item.id === itemId);
    if (index >= 0) pending.current = { itemId, index, readAt: readAt.current };
  }, []);

  useEffect(() => {
    const handoff = pending.current;
    shown.current = items;
    readAt.current = updatedAt;
    if (handoff === null) return;
    if (items.some((item) => item.id === handoff.itemId)) {
      if (handoff.readAt !== updatedAt) pending.current = null;
      return;
    }
    pending.current = null;
    const next = items[Math.min(handoff.index, items.length - 1)];
    const target = next === undefined ? allClear.current : (titles.current.get(next.id) ?? null);
    target?.focus();
  }, [items, updatedAt]);

  return { titleRef, allClearRef, markActed };
}
