import { useCallback } from "react";

const STICKY_OFFSET_PROPERTY = "--trace-sticky-height";

export function useStickyOffset(): (element: HTMLElement | null) => void | (() => void) {
  return useCallback((element) => {
    const scope = element?.parentElement;
    if (element === null || scope === null || scope === undefined) return;
    const write = () =>
      scope.style.setProperty(STICKY_OFFSET_PROPERTY, `${element.offsetHeight}px`);
    write();
    if (typeof ResizeObserver === "undefined")
      return () => scope.style.removeProperty(STICKY_OFFSET_PROPERTY);
    const observer = new ResizeObserver(write);
    observer.observe(element);
    return () => {
      observer.disconnect();
      scope.style.removeProperty(STICKY_OFFSET_PROPERTY);
    };
  }, []);
}
