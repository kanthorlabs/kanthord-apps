import { type MouseEvent, type PointerEvent, useRef } from "react";

const SWIPE_MIN_PX = 40;
const CLICK_GRACE_MS = 400;

interface Origin {
  readonly x: number;
  readonly y: number;
}

export interface DeckSwipe {
  readonly onPointerDown: (event: PointerEvent) => void;
  readonly onPointerUp: (event: PointerEvent) => void;
  readonly onPointerCancel: () => void;
  readonly onClickCapture: (event: MouseEvent) => void;
}

export function useDeckSwipe(step: (delta: number) => void): DeckSwipe {
  const origin = useRef<Origin | null>(null);
  const swipedAt = useRef<number | null>(null);

  return {
    onPointerDown: (event) => {
      origin.current =
        event.pointerType === "touch" ? { x: event.clientX, y: event.clientY } : null;
    },
    onPointerUp: (event) => {
      const start = origin.current;
      origin.current = null;
      if (start === null) return;
      const sideways = event.clientX - start.x;
      const vertical = event.clientY - start.y;
      if (Math.abs(sideways) < SWIPE_MIN_PX || Math.abs(sideways) <= Math.abs(vertical)) return;
      swipedAt.current = event.timeStamp;
      step(sideways < 0 ? 1 : -1);
    },
    onPointerCancel: () => {
      origin.current = null;
    },
    onClickCapture: (event) => {
      const at = swipedAt.current;
      if (at === null) return;
      swipedAt.current = null;
      if (event.timeStamp - at >= CLICK_GRACE_MS) return;
      event.preventDefault();
      event.stopPropagation();
    },
  };
}
