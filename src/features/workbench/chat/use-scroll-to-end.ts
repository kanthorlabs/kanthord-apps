import { useEffect } from "react";

export function useScrollToEnd(items: unknown, approval: unknown) {
  useEffect(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight });
  }, [items, approval]);
}
