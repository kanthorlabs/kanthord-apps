import { type RefObject, useEffect, useState } from "react";

import { BOARD_WIDTH, type BoardWidth, boardWidthClassOf } from "@/lib/board-width";

export function useBoardWidth(ref: RefObject<HTMLElement | null>): BoardWidth {
  const [widthClass, setWidthClass] = useState<BoardWidth>(BOARD_WIDTH.Expanded);

  useEffect(() => {
    const element = ref.current;
    if (element === null) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (entry !== undefined) setWidthClass(boardWidthClassOf(entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return widthClass;
}
